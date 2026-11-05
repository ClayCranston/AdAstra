import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { addDays, dateInZone, weekDates, weekday, type Goal } from "./domain";

let instance: Database.Database | undefined;
export function db() {
  if (instance) return instance;
  const path = process.env.DATABASE_PATH || "./data/adastra.sqlite";
  mkdirSync(dirname(path), { recursive: true });
  instance = new Database(path);
  instance.pragma("busy_timeout = 5000");
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(`
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles', tone TEXT NOT NULL DEFAULT 'light', cutoff TEXT NOT NULL DEFAULT '21:00',
      paused INTEGER NOT NULL DEFAULT 0, email_preview INTEGER NOT NULL DEFAULT 1, google_sub TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS memberships (org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES profiles(id),
      role TEXT NOT NULL CHECK(role IN ('owner','admin','member')), PRIMARY KEY(org_id,user_id));
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES profiles(id), PRIMARY KEY(group_id,user_id));
    CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id), org_id TEXT NOT NULL REFERENCES organizations(id),
      group_id TEXT REFERENCES groups(id), title TEXT NOT NULL, shared_label TEXT NOT NULL, category TEXT NOT NULL, kind TEXT NOT NULL,
      target REAL NOT NULL, target_max REAL, unit TEXT NOT NULL, days TEXT NOT NULL, due_time TEXT NOT NULL, created_date TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS checkins (goal_id TEXT NOT NULL REFERENCES goals(id), date TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY(goal_id,date));
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id), kind TEXT NOT NULL,
      body TEXT NOT NULL, subject TEXT NOT NULL, date TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, email_preview INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id,kind,date));
    CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','member')), expires_at TEXT NOT NULL, accepted_by TEXT REFERENCES profiles(id));
    CREATE INDEX IF NOT EXISTS goals_owner_org ON goals(user_id,org_id,archived);
    CREATE INDEX IF NOT EXISTS memberships_user ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS groups_org ON groups(org_id);
    CREATE INDEX IF NOT EXISTS messages_user_date ON messages(user_id,date);
    CREATE INDEX IF NOT EXISTS checkins_date ON checkins(date);
  `);
  const initialized = instance;
  initialized
    .transaction(() => {
      if (!initialized.prepare("SELECT 1 FROM profiles LIMIT 1").get())
        seed(initialized);
      migrateStarter(initialized);
    })
    .immediate();
  return instance;
}

function migrateStarter(d: Database.Database) {
  d.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)",
  );
  if (
    d
      .prepare("SELECT 1 FROM schema_migrations WHERE version='original-crew'")
      .get()
  )
    return;
  // Rename the previous demo fixtures while preserving any locally created goals/check-ins.
  d.pragma("defer_foreign_keys = ON");
  if (d.prepare("SELECT 1 FROM organizations WHERE id='northstar'").get()) {
    d.prepare(
      "UPDATE organizations SET id='original',name='original' WHERE id='northstar'",
    ).run();
    for (const table of ["memberships", "groups", "goals", "invitations"])
      d.prepare(
        `UPDATE ${table} SET org_id='original' WHERE org_id='northstar'`,
      ).run();
  }
  if (
    d
      .prepare(
        "SELECT 1 FROM profiles WHERE id='marcus' AND email='marcus@example.test'",
      )
      .get()
  ) {
    d.prepare(
      "UPDATE profiles SET id='eames',name='Eames',email='eames@example.test' WHERE id='marcus'",
    ).run();
    for (const table of ["memberships", "group_members", "goals", "messages"])
      d.prepare(
        `UPDATE ${table} SET user_id='eames' WHERE user_id='marcus'`,
      ).run();
    d.prepare(
      "UPDATE invitations SET accepted_by='eames' WHERE accepted_by='marcus'",
    ).run();
    d.prepare(
      "UPDATE memberships SET role='member' WHERE org_id='original' AND user_id='eames'",
    ).run();
  }
  // Retain retired demo records on disk; remove the extra profile from active membership.
  if (
    d
      .prepare(
        "SELECT 1 FROM profiles WHERE id='alex' AND email='alex@example.test'",
      )
      .get()
  ) {
    d.prepare("UPDATE profiles SET paused=1 WHERE id='alex'").run();
    d.prepare("DELETE FROM group_members WHERE user_id='alex'").run();
    d.prepare("DELETE FROM memberships WHERE user_id='alex'").run();
  }
  const unused = d
    .prepare(
      "SELECT 1 FROM organizations WHERE id='sidequest' AND name='Side Project Society' AND NOT EXISTS(SELECT 1 FROM goals WHERE org_id='sidequest') AND NOT EXISTS(SELECT 1 FROM invitations WHERE org_id='sidequest') AND (SELECT count(*) FROM groups WHERE org_id='sidequest')=1 AND (SELECT count(*) FROM memberships WHERE org_id='sidequest')=1",
    )
    .get();
  if (unused) {
    d.prepare("DELETE FROM group_members WHERE group_id='makers'").run();
    d.prepare("DELETE FROM groups WHERE id='makers'").run();
    d.prepare("DELETE FROM memberships WHERE org_id='sidequest'").run();
    d.prepare("DELETE FROM organizations WHERE id='sidequest'").run();
  }
  d.prepare("INSERT INTO schema_migrations VALUES('original-crew')").run();
}

function seed(d: Database.Database) {
  d.transaction(() => {
    const today = dateInZone();
    const monday = weekDates(today)[0];
    const profile = d.prepare(
      "INSERT INTO profiles(id,name,email) VALUES(?,?,?)",
    );
    profile.run("clay", "Clay", "clay@example.test");
    profile.run("eames", "Eames", "eames@example.test");
    d.prepare("INSERT INTO organizations VALUES(?,?,?)").run(
      "original",
      "original",
      "Small promises. Shared ambition. A little friendly pressure.",
    );
    const member = d.prepare("INSERT INTO memberships VALUES(?,?,?)");
    member.run("original", "clay", "owner");
    member.run("original", "eames", "member");
    const group = d.prepare("INSERT INTO groups VALUES(?,?,?,?)");
    group.run(
      "boys",
      "original",
      "The Morning Crew",
      "Show up for yourself. We'll bring the encouragement.",
    );
    group.run(
      "builders",
      "original",
      "Deep Work Club",
      "Less tab switching. More things finished.",
    );
    const gm = d.prepare("INSERT INTO group_members VALUES(?,?)");
    for (const u of ["clay", "eames"]) gm.run("boys", u);
    gm.run("builders", "clay");
    gm.run("builders", "eames");
    const insert = d.prepare(
      `INSERT INTO goals(id,user_id,org_id,group_id,title,shared_label,category,kind,target,target_max,unit,days,due_time,created_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const fixtures: [
      string,
      string,
      string,
      string | null,
      string,
      string,
      string,
      string,
      number,
      number | null,
      string,
      string,
      string,
    ][] = [
      [
        "gym",
        "clay",
        "original",
        "boys",
        "Show up. Lift something heavy.",
        "Strength session",
        "Gym",
        "binary",
        1,
        null,
        "session",
        "1,3,5",
        "08:00",
      ],
      [
        "focus",
        "clay",
        "original",
        "builders",
        "Make room for deep work",
        "Focus block",
        "Work",
        "quantity",
        90,
        null,
        "minutes",
        "1,2,3,4,5",
        "17:00",
      ],
      [
        "walk",
        "clay",
        "original",
        "boys",
        "Get outside, clear your head",
        "Daily movement",
        "Fitness",
        "quantity",
        8000,
        null,
        "steps",
        "0,1,2,3,4,5,6",
        "19:00",
      ],
      [
        "journal",
        "clay",
        "original",
        null,
        "A little space to think",
        "Mindful moment",
        "Mind",
        "binary",
        1,
        null,
        "session",
        "0,1,2,3,4,5,6",
        "21:00",
      ],
      [
        "nutrition",
        "clay",
        "original",
        null,
        "Keep nutrition intentional",
        "Nutrition goal",
        "Nutrition",
        "range",
        2100,
        2500,
        "kcal",
        "0,1,2,3,4,5,6",
        "20:00",
      ],
      [
        "budget",
        "clay",
        "original",
        null,
        "Check in with future you",
        "Money check-in",
        "Money",
        "binary",
        1,
        null,
        "review",
        "0",
        "18:00",
      ],
      [
        "eames-run",
        "eames",
        "original",
        "boys",
        "An easy run before work",
        "Morning run",
        "Fitness",
        "quantity",
        5,
        null,
        "km",
        "0,1,2,3,4,5,6",
        "08:00",
      ],
      [
        "eames-money",
        "eames",
        "original",
        null,
        "Private savings transfer",
        "Money goal",
        "Money",
        "quantity",
        500,
        null,
        "dollars",
        "0,1,2,3,4,5,6",
        "18:00",
      ],
    ];
    for (const row of fixtures) insert.run(...row, addDays(monday, -7));
    const check = d.prepare("INSERT INTO checkins VALUES(?,?,?)");
    const goals = d.prepare("SELECT * FROM goals").all() as Goal[];
    for (const date of weekDates(today).filter((v) => v < today))
      for (const g of goals) {
        if (
          g.days.split(",").includes(String(weekday(date))) &&
          g.id !== "eames-money"
        )
          check.run(g.id, date, g.kind === "range" ? 2300 : g.target);
      }
    check.run("eames-run", today, 5);
    if ([1, 2, 3, 4, 5].includes(weekday(today))) check.run("focus", today, 45);
    d.prepare(
      "INSERT INTO messages(id,user_id,kind,body,subject,date) VALUES(?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      "clay",
      "welcome",
      "Your goals, your pace. Choose a few promises worth keeping, and let your crew help you keep them. This workspace contains sample profiles and sample history so you can explore everything locally.",
      "A little accountability. A lot of possibility.",
      today,
    );
  })();
}
