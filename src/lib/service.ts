import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import {
  categories,
  credit,
  dateInZone,
  dueOn,
  score,
  weekDates,
  timeInZone,
  weekday,
  type Profile,
  type Org,
  type Goal,
  type Group,
  type Checkin,
  type Member,
  type Message,
  type Role,
} from "./domain";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const name = z.string().trim().min(1).max(80);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export function membership(userId: string, orgId: string, admin = false) {
  const m = db()
    .prepare("SELECT role FROM memberships WHERE user_id=? AND org_id=?")
    .get(userId, orgId) as { role: Role } | undefined;
  if (!m || (admin && !["owner", "admin"].includes(m.role)))
    throw new AppError(
      "You don't have permission to do that in this organization.",
      403,
    );
  return m;
}
export function snapshot(userId: string, orgId?: string) {
  const d = db();
  const me = d
    .prepare(
      "SELECT id,name,email,timezone,tone,cutoff,paused,email_preview FROM profiles WHERE id=?",
    )
    .get(userId) as Profile;
  if (!me) throw new AppError("Please sign in again.", 401);
  const orgs = d
    .prepare(
      "SELECT o.*,m.role FROM organizations o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=? ORDER BY o.rowid",
    )
    .all(userId) as Org[];
  const active = orgId || orgs[0]?.id;
  if (active) membership(userId, active);
  const org = orgs.find((o) => o.id === active) || null;
  const today = dateInZone(me.timezone),
    week = weekDates(today);
  const groups = active
    ? (d
        .prepare(
          `SELECT g.*, (SELECT count(*) FROM group_members WHERE group_id=g.id) member_count,
    (SELECT count(*) FROM group_members WHERE group_id=g.id AND user_id=?) joined FROM groups g WHERE g.org_id=? ORDER BY g.rowid`,
        )
        .all(userId, active) as Group[])
    : [];
  const goals = active
    ? (d
        .prepare(
          "SELECT * FROM goals WHERE user_id=? AND org_id=? AND archived=0 ORDER BY due_time,id",
        )
        .all(userId, active) as Goal[])
    : [];
  const checkins = d
    .prepare(
      "SELECT c.* FROM checkins c JOIN goals g ON g.id=c.goal_id WHERE g.user_id=? AND c.date>=? AND c.date<=?",
    )
    .all(userId, week[0], today) as Checkin[];
  const members = active
    ? (d
        .prepare(
          "SELECT p.id,p.name,m.role FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.org_id=? ORDER BY m.rowid",
        )
        .all(active) as Member[])
    : [];
  for (const m of members) {
    m.groups = (
      d
        .prepare(
          "SELECT gm.group_id FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.user_id=? AND g.org_id=?",
        )
        .all(m.id, active) as { group_id: string }[]
    ).map((g) => g.group_id);
    // Only shared goals in groups BOTH users belong to. Never serialize private fields.
    const shared = d
      .prepare(
        `SELECT g.* FROM goals g JOIN group_members viewer ON viewer.group_id=g.group_id AND viewer.user_id=?
      JOIN group_members owner ON owner.group_id=g.group_id AND owner.user_id=g.user_id
      WHERE g.user_id=? AND g.org_id=? AND g.archived=0`,
      )
      .all(userId, m.id, active) as Goal[];
    m.shared = shared
      .filter((g) => dueOn(g, today))
      .map((g) => {
        const c = d
          .prepare("SELECT value FROM checkins WHERE goal_id=? AND date=?")
          .get(g.id, today) as { value: number } | undefined;
        return {
          groupId: g.group_id!,
          label: g.shared_label,
          category: g.category,
          status: !c
            ? "not checked in"
            : credit(g, c.value) === 1
              ? "complete"
              : "in progress",
        };
      });
  }
  const messages = d
    .prepare(
      "SELECT id,kind,body,subject,date,read,email_preview FROM messages WHERE user_id=? ORDER BY date DESC,rowid DESC LIMIT 50",
    )
    .all(userId) as Message[];
  const invites =
    org && org.role !== "member"
      ? d
          .prepare(
            "SELECT id,token,role,expires_at FROM invitations WHERE org_id=? AND accepted_by IS NULL AND expires_at>? ORDER BY rowid DESC",
          )
          .all(active, new Date().toISOString())
      : [];
  return {
    me,
    orgs,
    org,
    groups,
    goals,
    checkins,
    members,
    messages,
    today,
    week,
    invites,
  };
}

export function generateMessage(
  userId: string,
  kind: "daily" | "weekly",
  date?: string,
) {
  const d = db(),
    p = d.prepare("SELECT * FROM profiles WHERE id=?").get(userId) as Profile;
  if (p.paused)
    throw new AppError("Messages are paused. Resume them in Settings first.");
  const today = date || dateInZone(p.timezone);
  const goals = d
    .prepare("SELECT * FROM goals WHERE user_id=? AND archived=0")
    .all(userId) as Goal[];
  const checkins = d
    .prepare(
      "SELECT c.* FROM checkins c JOIN goals g ON g.id=c.goal_id WHERE g.user_id=? AND c.date BETWEEN ? AND ?",
    )
    .all(userId, weekDates(today)[0], today) as Checkin[];
  const s = score(goals, checkins, today);
  let subject = "Your daily check-in",
    body = "A little space to reset. No commitments scheduled today. Enjoy it.";
  if (kind === "weekly") {
    const stats = weekDates(today)
      .filter((date) => date <= today)
      .map((date) => score(goals, checkins, date));
    const total = stats.reduce((sum, v) => sum + v.total, 0),
      done = stats.reduce((sum, v) => sum + v.complete, 0);
    subject = "Look at what you showed up for.";
    body = total
      ? `You completed ${done} of ${total} scheduled commitments this week so far. Every one of those was a choice to show up. Keep what worked, make the hard parts smaller, and give yourself credit. Your crew is in your corner.`
      : "A fresh week is yours to shape. Pick one small promise you can keep. We'll be here cheering you on.";
  } else if (s.total) {
    if (s.logged < s.total)
      body = `You've completed ${s.complete} of ${s.total} commitments. ${s.total - s.logged} still need a check-in, so we're holding the verdict. Tell us how the day actually went.`;
    else if (s.complete === s.total) {
      subject = "Promises kept. Credit earned.";
      body = `${s.complete} for ${s.total}. You did what you said you would. That's the whole thing. Take the win—your crew noticed.`;
    } else if (p.tone === "supportive")
      body = `You completed ${s.complete} of ${s.total} commitments. A hard day doesn't cancel your progress. Choose one small adjustment for tomorrow.`;
    else if (p.tone === "banter")
      body = `${s.complete} of ${s.total}. Your to-do list has filed a missing-person report. Make tomorrow's promises a little smaller, then actually show up. We're rooting for you.`;
    else
      body = `${s.complete} of ${s.total}. Ambitious planning, selective execution. Tomorrow, let's get those two on speaking terms. You've got this.`;
  }
  d.prepare(
    `INSERT INTO messages(id,user_id,kind,body,subject,date,email_preview) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id,kind,date) DO UPDATE SET body=excluded.body,subject=excluded.subject,email_preview=excluded.email_preview,
      read=CASE WHEN messages.body=excluded.body THEN messages.read ELSE 0 END`,
  ).run(randomUUID(), userId, kind, body, subject, today, p.email_preview);
}

export function mutate(userId: string, input: unknown) {
  const action = z.object({ action: z.string() }).parse(input).action;
  const d = db();
  const me = d
    .prepare("SELECT * FROM profiles WHERE id=?")
    .get(userId) as Profile;
  if (!me) throw new AppError("Please sign in again.", 401);
  if (action === "checkin") {
    const data = z
      .object({
        goalId: z.string(),
        date: z.iso.date(),
        value: z.number().finite().min(0).max(1e9).nullable(),
      })
      .parse(input);
    const goal = d
      .prepare("SELECT * FROM goals WHERE id=? AND user_id=? AND archived=0")
      .get(data.goalId, userId) as Goal | undefined;
    if (!goal) throw new AppError("That goal isn't available.", 404);
    membership(userId, goal.org_id);
    if (data.date !== dateInZone(me.timezone) || !dueOn(goal, data.date))
      throw new AppError(
        "Check-ins are available for today's scheduled commitments.",
      );
    if (data.value === null)
      d.prepare("DELETE FROM checkins WHERE goal_id=? AND date=?").run(
        goal.id,
        data.date,
      );
    else {
      if (goal.kind === "binary" && ![0, 1].includes(data.value))
        throw new AppError("Choose complete or missed.");
      d.prepare(
        "INSERT INTO checkins VALUES(?,?,?) ON CONFLICT(goal_id,date) DO UPDATE SET value=excluded.value",
      ).run(goal.id, data.date, data.value);
    }
  } else if (action === "createGoal") {
    const data = z
      .object({
        orgId: z.string(),
        groupId: z.string().nullable(),
        title: name,
        sharedLabel: name,
        category: z.enum(categories),
        kind: z.enum(["binary", "quantity", "range"]),
        target: z.number().positive().max(1e9),
        targetMax: z.number().positive().max(1e9).nullable(),
        unit: z.string().trim().max(20),
        days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        dueTime: time,
      })
      .parse(input);
    membership(userId, data.orgId);
    if (
      data.groupId &&
      !d
        .prepare(
          "SELECT 1 FROM groups g JOIN group_members m ON m.group_id=g.id WHERE g.id=? AND g.org_id=? AND m.user_id=?",
        )
        .get(data.groupId, data.orgId, userId)
    )
      throw new AppError("Join this group before sharing a goal with it.", 403);
    if (
      data.kind === "range" &&
      (data.targetMax === null || data.targetMax < data.target)
    )
      throw new AppError("The upper target must be at least the lower target.");
    d.prepare(
      `INSERT INTO goals(id,user_id,org_id,group_id,title,shared_label,category,kind,target,target_max,unit,days,due_time,created_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      randomUUID(),
      userId,
      data.orgId,
      data.groupId,
      data.title,
      data.sharedLabel,
      data.category,
      data.kind,
      data.kind === "binary" ? 1 : data.target,
      data.kind === "range" ? data.targetMax : null,
      data.unit,
      [...new Set(data.days)].sort().join(","),
      data.dueTime,
      dateInZone(me.timezone),
    );
  } else if (action === "archiveGoal") {
    const { goalId } = z.object({ goalId: z.string() }).parse(input);
    const result = d
      .prepare("UPDATE goals SET archived=1 WHERE id=? AND user_id=?")
      .run(goalId, userId);
    if (!result.changes) throw new AppError("Goal not found.", 404);
  } else if (action === "createOrg") {
    const data = z
      .object({ name, description: z.string().trim().max(240) })
      .parse(input);
    const id = randomUUID(),
      group = randomUUID();
    d.transaction(() => {
      d.prepare("INSERT INTO organizations VALUES(?,?,?)").run(
        id,
        data.name,
        data.description,
      );
      d.prepare("INSERT INTO memberships VALUES(?,?,?)").run(
        id,
        userId,
        "owner",
      );
      d.prepare("INSERT INTO groups VALUES(?,?,?,?)").run(
        group,
        id,
        "The Crew",
        "Your first accountability group.",
      );
      d.prepare("INSERT INTO group_members VALUES(?,?)").run(group, userId);
    })();
    return { orgId: id };
  } else if (action === "createGroup") {
    const data = z
      .object({
        orgId: z.string(),
        name,
        description: z.string().trim().max(240),
      })
      .parse(input);
    membership(userId, data.orgId, true);
    const id = randomUUID();
    d.transaction(() => {
      d.prepare("INSERT INTO groups VALUES(?,?,?,?)").run(
        id,
        data.orgId,
        data.name,
        data.description,
      );
      d.prepare("INSERT INTO group_members VALUES(?,?)").run(id, userId);
    })();
  } else if (action === "joinGroup") {
    const { groupId } = z.object({ groupId: z.string() }).parse(input);
    const group = d
      .prepare("SELECT org_id FROM groups WHERE id=?")
      .get(groupId) as { org_id: string } | undefined;
    if (!group) throw new AppError("Group not found.", 404);
    membership(userId, group.org_id);
    d.prepare("INSERT OR IGNORE INTO group_members VALUES(?,?)").run(
      groupId,
      userId,
    );
  } else if (action === "createInvite") {
    const data = z
      .object({ orgId: z.string(), role: z.enum(["member", "admin"]) })
      .parse(input);
    const m = membership(userId, data.orgId, true);
    if (data.role === "admin" && m.role !== "owner")
      throw new AppError("Only owners can invite administrators.", 403);
    const token = randomBytes(18).toString("base64url"),
      expires = new Date(Date.now() + 7 * 864e5).toISOString();
    d.prepare(
      "INSERT INTO invitations(id,org_id,token,role,expires_at) VALUES(?,?,?,?,?)",
    ).run(randomUUID(), data.orgId, token, data.role, expires);
    return { token };
  } else if (action === "acceptInvite") {
    const { token } = z
      .object({ token: z.string().trim().min(1).max(100) })
      .parse(input);
    return d.transaction(() => {
      const inv = d
        .prepare(
          "SELECT * FROM invitations WHERE token=? AND accepted_by IS NULL AND expires_at>?",
        )
        .get(token, new Date().toISOString()) as
        { id: string; org_id: string; role: Role } | undefined;
      if (!inv)
        throw new AppError(
          "This invitation has expired or has already been used.",
        );
      if (
        d
          .prepare("SELECT 1 FROM memberships WHERE org_id=? AND user_id=?")
          .get(inv.org_id, userId)
      )
        throw new AppError("You're already a member of this organization.");
      d.prepare("INSERT INTO memberships VALUES(?,?,?)").run(
        inv.org_id,
        userId,
        inv.role,
      );
      d.prepare("UPDATE invitations SET accepted_by=? WHERE id=?").run(
        userId,
        inv.id,
      );
      return { orgId: inv.org_id };
    })();
  } else if (action === "settings") {
    const data = z
      .object({
        name,
        timezone: z.string().max(80),
        tone: z.enum(["supportive", "light", "banter"]),
        cutoff: time,
        paused: z.boolean(),
        emailPreview: z.boolean(),
      })
      .parse(input);
    try {
      dateInZone(data.timezone);
    } catch {
      throw new AppError("Choose a valid time zone.");
    }
    d.prepare(
      "UPDATE profiles SET name=?,timezone=?,tone=?,cutoff=?,paused=?,email_preview=? WHERE id=?",
    ).run(
      data.name,
      data.timezone,
      data.tone,
      data.cutoff,
      Number(data.paused),
      Number(data.emailPreview),
      userId,
    );
  } else if (action === "generateMessage") {
    const { kind } = z
      .object({ kind: z.enum(["daily", "weekly"]) })
      .parse(input);
    generateMessage(userId, kind);
  } else if (action === "markRead") {
    const { id } = z.object({ id: z.string() }).parse(input);
    d.prepare("UPDATE messages SET read=1 WHERE id=? AND user_id=?").run(
      id,
      userId,
    );
  } else throw new AppError("Unknown action.");
  return { ok: true };
}

export function runScheduled(now = new Date()) {
  const profiles = db()
    .prepare("SELECT * FROM profiles WHERE paused=0")
    .all() as Profile[];
  for (const p of profiles) {
    const date = dateInZone(p.timezone, now);
    if (timeInZone(p.timezone, now) < p.cutoff) continue;
    // Reconcile today's due evaluation only. Never emit a backlog of old roasts.
    generateMessage(p.id, "daily", date);
    if (weekday(date) === 0) generateMessage(p.id, "weekly", date);
  }
}
