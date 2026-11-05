import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "adastra-test-"));
process.env.DATABASE_PATH = join(dir, "test.sqlite");
import { db } from "../src/lib/db";
import {
  snapshot,
  mutate,
  generateMessage,
  membership,
  runScheduled,
} from "../src/lib/service";
import { credit, score, dateInZone, weekday } from "../src/lib/domain";
import type { Goal } from "../src/lib/domain";
db()
  .prepare(
    "INSERT INTO profiles(id,name,email) VALUES('test-admin','Test Admin','test-admin@example.test')",
  )
  .run();
db()
  .prepare("INSERT INTO memberships VALUES('original','test-admin','admin')")
  .run();
db()
  .prepare(
    "INSERT INTO organizations VALUES('sidequest','Test private org','Test isolation')",
  )
  .run();
db()
  .prepare("INSERT INTO memberships VALUES('sidequest','clay','owner')")
  .run();
after(() => {
  db().close();
  rmSync(dir, { recursive: true, force: true });
});

test("organization boundaries and group visibility do not disclose private goals", () => {
  assert.throws(() => snapshot("eames", "sidequest"), /permission/);
  const data = snapshot("clay", "original");
  assert.ok(data.goals.every((g) => g.user_id === "clay"));
  const json = JSON.stringify(data.members);
  assert.ok(!json.includes("Private savings transfer"));
  assert.ok(!json.includes("500"));
  assert.ok(!json.includes("Deep work"));
  assert.ok(
    data.members.every((m) =>
      m.shared.every(
        (g) => !("target" in g) && !("value" in g) && !("title" in g),
      ),
    ),
  );
  assert.ok(!JSON.stringify(data).includes("eames@example.test"));
});
test("members cannot manage groups or invite administrators", () => {
  assert.throws(
    () =>
      mutate("eames", {
        action: "createGroup",
        orgId: "original",
        name: "Unauthorized",
        description: "",
      }),
    /permission/,
  );
  assert.throws(
    () =>
      mutate("test-admin", {
        action: "createInvite",
        orgId: "original",
        role: "admin",
      }),
    /Only owners/,
  );
  assert.throws(
    () =>
      mutate("clay", {
        action: "checkin",
        goalId: "eames-run",
        date: dateInZone(),
        value: 5,
      }),
    /available/,
  );
});
test("new organization, invite acceptance, and group joining preserve tenancy", () => {
  const created = mutate("clay", {
    action: "createOrg",
    name: "Test crew",
    description: "Test boundary",
  }) as { orgId: string };
  const invite = mutate("clay", {
    action: "createInvite",
    orgId: created.orgId,
    role: "member",
  }) as { token: string };
  mutate("eames", { action: "acceptInvite", token: invite.token });
  assert.equal(membership("eames", created.orgId).role, "member");
  assert.throws(
    () => mutate("test-admin", { action: "acceptInvite", token: invite.token }),
    /already been used/,
  );
  const groups = snapshot("eames", created.orgId).groups;
  assert.equal(groups[0].joined, 0);
  mutate("eames", { action: "joinGroup", groupId: groups[0].id });
  assert.equal(snapshot("eames", created.orgId).groups[0].joined, 1);
  assert.throws(
    () => mutate("test-admin", { action: "joinGroup", groupId: groups[0].id }),
    /permission/,
  );
});
test("private targets, partial credit, range scoring, and missed versus unknown", () => {
  const base = snapshot("clay", "original").goals.find((g) => g.id === "walk")!;
  assert.equal(credit(base, 4000), 0.5);
  assert.equal(credit(base, 16000), 1);
  assert.equal(credit(base, undefined), 0);
  const range = {
    ...base,
    kind: "range",
    target: 2100,
    target_max: 2500,
  } as Goal;
  assert.equal(credit(range, 1800), 0);
  assert.equal(credit(range, 2300), 1);
  assert.equal(credit(range, 2800), 0);
  const date = dateInZone();
  const g = { ...base, days: String(weekday(date)) };
  assert.equal(score([g], [], date).logged, 0);
  assert.equal(score([g], [{ goal_id: g.id, date, value: 0 }], date).logged, 1);
  mutate("clay", { action: "checkin", goalId: "walk", date, value: 4000 });
  assert.equal(
    snapshot("clay", "original").checkins.find(
      (c) => c.goal_id === "walk" && c.date === date,
    )?.value,
    4000,
  );
  mutate("clay", { action: "checkin", goalId: "walk", date, value: null });
  assert.ok(
    !snapshot("clay", "original").checkins.some(
      (c) => c.goal_id === "walk" && c.date === date,
    ),
  );
});
test("invalid targets and unauthorized group sharing are rejected", () => {
  const input = {
    action: "createGoal",
    orgId: "original",
    groupId: null,
    title: "Test",
    sharedLabel: "Safe label",
    category: "Nutrition",
    kind: "range",
    target: 10,
    targetMax: 5,
    unit: "units",
    days: [0, 1, 2, 3, 4, 5, 6],
    dueTime: "18:00",
  };
  assert.throws(() => mutate("clay", input), /upper target/);
  assert.throws(
    () =>
      mutate("eames", {
        ...input,
        kind: "binary",
        target: 1,
        targetMax: null,
        groupId: "makers-unavailable",
      }),
    /Join this group/,
  );
  assert.throws(() => mutate("clay", { ...input, target: NaN }), /number/);
});
test("daily messages are idempotent and never roast unknown check-ins", () => {
  generateMessage("clay", "daily");
  generateMessage("clay", "daily");
  const messages = snapshot("clay", "original").messages.filter(
    (m) => m.kind === "daily",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].body, /holding the verdict/);
  assert.doesNotMatch(messages[0].body, /2100|2500|8000/);
  const state = snapshot("clay", "original");
  for (const goal of state.goals.filter((g) =>
    g.days.split(",").includes(String(weekday(state.today))),
  ))
    mutate("clay", {
      action: "checkin",
      goalId: goal.id,
      date: state.today,
      value: goal.target,
    });
  generateMessage("clay", "daily");
  const updated = snapshot("clay", "original").messages.filter(
    (m) => m.kind === "daily",
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, messages[0].id);
  assert.match(updated[0].body, /You did what you said/);
});
test("scheduler honors local cutoffs, paused users, and does not backfill stale roasts", () => {
  db().prepare("DELETE FROM messages WHERE user_id='eames'").run();
  db()
    .prepare(
      "UPDATE profiles SET timezone='America/Los_Angeles',cutoff='21:00' WHERE id='eames'",
    )
    .run();
  runScheduled(new Date("2026-11-04T20:00:00Z"));
  assert.equal(
    db()
      .prepare("SELECT count(*) n FROM messages WHERE user_id='eames'")
      .get() &&
      (
        db()
          .prepare("SELECT count(*) n FROM messages WHERE user_id='eames'")
          .get() as { n: number }
      ).n,
    0,
  );
  runScheduled(new Date("2026-11-05T06:00:00Z"));
  runScheduled(new Date("2026-11-05T06:01:00Z"));
  const messages = db()
    .prepare("SELECT * FROM messages WHERE user_id='eames'")
    .all() as { date: string }[];
  assert.equal(messages.length, 1);
  assert.equal(messages[0].date, "2026-11-04");
  db().prepare("UPDATE profiles SET paused=1 WHERE id='eames'").run();
  assert.throws(() => generateMessage("eames", "daily"), /paused/);
  runScheduled(new Date("2026-11-06T06:01:00Z"));
  assert.equal(
    (
      db()
        .prepare("SELECT count(*) n FROM messages WHERE user_id='eames'")
        .get() as { n: number }
    ).n,
    1,
  );
});
