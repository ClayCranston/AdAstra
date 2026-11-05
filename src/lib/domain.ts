export const categories = [
  "Gym",
  "Work",
  "Mind",
  "Fitness",
  "Nutrition",
  "Money",
] as const;
export type Category = (typeof categories)[number];
export type Role = "owner" | "admin" | "member";
export type Profile = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  tone: string;
  cutoff: string;
  paused: number;
  email_preview: number;
};
export type Org = { id: string; name: string; description: string; role: Role };
export type Group = {
  id: string;
  name: string;
  description: string;
  member_count: number;
  joined: number;
};
export type Goal = {
  id: string;
  user_id: string;
  org_id: string;
  group_id: string | null;
  title: string;
  shared_label: string;
  category: Category;
  kind: "binary" | "quantity" | "range";
  target: number;
  target_max: number | null;
  unit: string;
  days: string;
  due_time: string;
  created_date: string;
  archived: number;
};
export type Checkin = { goal_id: string; date: string; value: number };
export type Message = {
  id: string;
  kind: string;
  body: string;
  subject: string;
  date: string;
  read: number;
  email_preview: number;
};
export type Member = {
  id: string;
  name: string;
  role: Role;
  groups: string[];
  shared: {
    groupId: string;
    label: string;
    category: Category;
    status: "complete" | "in progress" | "not checked in";
  }[];
};
export type Snapshot = {
  me: Profile;
  orgs: Org[];
  org: Org | null;
  groups: Group[];
  goals: Goal[];
  checkins: Checkin[];
  members: Member[];
  messages: Message[];
  today: string;
  week: string[];
  profiles: { id: string; name: string }[];
  invites: { id: string; token: string; role: Role; expires_at: string }[];
  googleEnabled: boolean;
};

export function dateInZone(
  zone = "America/Los_Angeles",
  date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function timeInZone(zone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function weekDates(date: string) {
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function dueOn(goal: Goal, date: string) {
  return (
    !goal.archived &&
    goal.created_date <= date &&
    goal.days.split(",").map(Number).includes(weekday(date))
  );
}
export function credit(goal: Goal, value?: number) {
  if (value === undefined) return 0;
  if (goal.kind === "binary") return value >= 1 ? 1 : 0;
  if (goal.kind === "range")
    return value >= goal.target && value <= (goal.target_max ?? goal.target)
      ? 1
      : 0;
  return Math.max(0, Math.min(1, value / goal.target));
}
export function score(goals: Goal[], checkins: Checkin[], date: string) {
  const due = goals.filter((g) => dueOn(g, date));
  const values = due.map(
    (g) => checkins.find((c) => c.goal_id === g.id && c.date === date)?.value,
  );
  const points = due.reduce((sum, g, i) => sum + credit(g, values[i]), 0);
  return {
    total: due.length,
    complete: due.filter((g, i) => credit(g, values[i]) === 1).length,
    logged: values.filter((v) => v !== undefined).length,
    percent: due.length ? Math.round((points / due.length) * 100) : 0,
  };
}
