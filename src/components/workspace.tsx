"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { signOut } from "next-auth/react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  Inbox,
  Leaf,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  categories,
  credit,
  dueOn,
  score,
  type Category,
  type Goal,
  type Message,
  type Snapshot,
} from "@/lib/domain";
import { GoogleMark } from "./login";

type Tab =
  | "today"
  | "goals"
  | "calendar"
  | "groups"
  | "organization"
  | "inbox"
  | "settings";
type Modal =
  | { type: "goal" | "org" | "group" | "invite" | "join" | "help" }
  | { type: "checkin" | "archive"; goal: Goal }
  | { type: "email"; message: Message };
const nav: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "My day", icon: Sun },
  { id: "goals", label: "My goals", icon: Target },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "groups", label: "My groups", icon: Users },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "inbox", label: "Inbox", icon: Inbox },
];
const icons: Record<Category, LucideIcon> = {
  Gym: Dumbbell,
  Work: Zap,
  Mind: Leaf,
  Fitness: Activity,
  Nutrition: Heart,
  Money: Wallet,
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const targetLabel = (g: Goal) =>
  g.kind === "binary"
    ? "One small promise"
    : `${g.target.toLocaleString()}${g.kind === "range" ? `–${g.target_max?.toLocaleString()}` : ""} ${g.unit}`;
function CategoryIcon({ category }: { category: Category }) {
  const Icon = icons[category];
  return (
    <span className={`category-icon category-${category.toLowerCase()}`}>
      <Icon size={19} />
    </span>
  );
}
function Empty({
  icon: Icon = Sparkles,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function ProgressRing({ value }: { value: number }) {
  return (
    <div className="progress-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r="51"
          className="ring-value"
          strokeDasharray={`${value * 3.2044} 320.44`}
        />
      </svg>
      <div>
        <strong>
          {value}
          <small>%</small>
        </strong>
        <span>FOLLOW-THROUGH</span>
      </div>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function Workspace() {
  const [data, setData] = useState<Snapshot | null>(null),
    [orgId, setOrgId] = useState(""),
    [tab, setTab] = useState<Tab>("today"),
    [day, setDay] = useState(""),
    [filter, setFilter] = useState("All"),
    [group, setGroup] = useState("");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [menu, setMenu] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const query = matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setMenu(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const load = useCallback(async (id: string) => {
    const sequence = ++request.current;
    try {
      const response = await fetch(
        `/api/workspace${id ? `?org=${encodeURIComponent(id)}` : ""}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        location.assign("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (sequence === request.current) {
        setData(result);
        setDay((v) => v || result.today);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the workspace.");
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setLoading(true);
    void load(orgId);
  }, [orgId, load]);
  useEffect(() => {
    const update = () => {
      const value = location.hash.slice(1) as Tab;
      if ([...nav.map((n) => n.id), "settings"].includes(value)) setTab(value);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next: Tab) {
    setTab(next);
    location.hash = next;
    setMenu(false);
    setError("");
    window.scrollTo({ top: 0 });
  }
  async function act(input: Record<string, unknown>, success = "Saved") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.orgId) {
        setOrgId(result.orgId);
        setGroup("");
      } else await load(orgId);
      setToast(success);
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't save. Please try again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function submit(
    e: FormEvent<HTMLFormElement>,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const result = await act({ action, ...values, ...extra });
    if (result) setModal(null);
  }
  function open(m: Modal) {
    setError("");
    setModal(m);
  }
  if (!data)
    return (
      <main className="loading-screen">
        <Compass size={36} />
        <h1>Finding your starting point.</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="primary" onClick={() => load(orgId)}>
              Try again
            </button>
          </>
        ) : (
          <p>Getting your day ready…</p>
        )}
      </main>
    );
  const current = day || data.today,
    stats = score(data.goals, data.checkins, current),
    today = score(data.goals, data.checkins, data.today);
  const isToday = current === data.today,
    joined = data.groups.filter((g) => g.joined),
    currentGroup =
      data.groups.find((g) => g.id === group) || joined[0] || data.groups[0];
  const due = data.goals.filter((g) => dueOn(g, current)),
    shown = due.filter((g) => filter === "All" || g.category === filter);
  const canManage = data.org?.role === "owner" || data.org?.role === "admin";
  const unread = data.messages.filter((m) => !m.read).length;
  const weekStats = data.week
    .filter((d) => d <= data.today)
    .map((d) => score(data.goals, data.checkins, d));
  const weekDone = weekStats.reduce((a, s) => a + s.complete, 0),
    weekTotal = weekStats.reduce((a, s) => a + s.total, 0);
  const newGoalButton = (
    <button
      className="primary"
      onClick={() => open({ type: "goal" })}
      disabled={!data.org}
    >
      <Plus size={17} />
      New goal
    </button>
  );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="main-sidebar"
        inert={mobile && !menu}
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <a href="#today" onClick={() => navigate("today")} className="brand">
          <Compass size={29} />
          <span>
            ad astra<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-picker">
          <span className="workspace-symbol">
            {initials(data.org?.name || "My space")}
          </span>
          <div>
            <span className="eyebrow">YOUR ORGANIZATION</span>
            <select
              aria-label="Active organization"
              value={data.org?.id || ""}
              onChange={(e) => {
                setOrgId(e.target.value);
                setGroup("");
                setDay(data.today);
              }}
            >
              {data.orgs.length ? (
                data.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              ) : (
                <option value="">Your next chapter</option>
              )}
            </select>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">YOUR SPACE</span>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "inbox" && unread > 0 && <small>{unread}</small>}
              {id === "today" && <span className="nav-spark">✦</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-groups">
          <span className="nav-label">YOUR CREWS</span>
          {joined.map((g, i) => (
            <button
              key={g.id}
              onClick={() => {
                setGroup(g.id);
                navigate("groups");
              }}
            >
              <span className={`group-dot dot-${i}`} />
              {g.name}
            </button>
          ))}
          {!joined.length && (
            <span className="sidebar-hint">A little better, together.</span>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="live-dot" />
            <div>
              <strong>Your local workspace</strong>
              <small>Sample profiles · data stays here</small>
            </div>
          </div>
          <button
            className={`settings-link ${tab === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} />
            Settings
          </button>
          <button
            className="profile-switch"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <span className="avatar color-0">{initials(data.me.name)}</span>
            <span>
              <strong>{data.me.name}</strong>
              <small>
                {data.profiles.length ? "Switch local profile" : "Sign out"}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace" inert={mobile && menu}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            aria-controls="main-sidebar"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>{data.org?.name || "Your workspace"}</span>
            <ChevronRight size={13} />
            <strong>
              {tab === "settings"
                ? "Settings"
                : nav.find((n) => n.id === tab)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              {dateLabel(data.today, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="About this local workspace"
              onClick={() => open({ type: "help" })}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="top-avatar avatar color-0"
              aria-label="Open profile settings"
              onClick={() => navigate("settings")}
            >
              {initials(data.me.name)}
            </button>
          </div>
        </header>
        <main
          id="main-content"
          className={`main-content ${loading ? "refreshing" : ""}`}
        >
          {error && !modal && (
            <div className="error-box" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {!data.org && tab !== "settings" && tab !== "inbox" ? (
            <Empty
              title="Your people. Your starting point."
              icon={Building2}
              action={
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() => open({ type: "org" })}
                  >
                    <Plus size={16} />
                    Create organization
                  </button>
                  <button
                    className="secondary"
                    onClick={() => open({ type: "join" })}
                  >
                    Use an invite
                  </button>
                </div>
              }
            >
              Create a home for your accountability groups, or join your friends
              with an invitation code.
            </Empty>
          ) : (
            <>
              {tab === "today" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        MAKE ROOM FOR WHAT MATTERS
                      </span>
                      <h1>
                        A little better, <em>{data.me.name}.</em>
                      </h1>
                      <p>
                        Small promises. Real progress. Your people in your
                        corner.
                      </p>
                    </div>
                    {newGoalButton}
                  </div>
                  <div className="day-layout">
                    <div className="day-primary">
                      <section className="daily-overview">
                        <div className="overview-copy">
                          <span className="eyebrow">
                            {isToday
                              ? "TODAY'S MOMENTUM"
                              : "YOUR FOLLOW-THROUGH"}
                          </span>
                          <h2>
                            {stats.total === 0
                              ? "Room to breathe."
                              : stats.complete === stats.total
                                ? "Look at you showing up."
                                : stats.complete > 0
                                  ? "You're making it happen."
                                  : "A fresh chance to show up."}
                          </h2>
                          <p>
                            {stats.total ? (
                              <>
                                You've kept{" "}
                                <strong>
                                  {stats.complete} of {stats.total}
                                </strong>{" "}
                                promises{isToday ? " today" : ""}.{" "}
                                {stats.complete === stats.total
                                  ? "Take the win."
                                  : "One small step at a time."}
                              </>
                            ) : (
                              "Rest is part of the plan. Add a goal when you're ready."
                            )}
                          </p>
                          <div className="overview-footer">
                            <span>
                              <span className="live-dot" />
                              {stats.total - stats.logged} awaiting check-in
                            </span>
                            <span>{stats.logged} logged</span>
                          </div>
                        </div>
                        <ProgressRing value={stats.percent} />
                      </section>
                      <section className="commitment-section">
                        <div className="section-heading">
                          <h2>
                            Your commitments{" "}
                            <span className="count-pill">{due.length}</span>
                          </h2>
                          <span>
                            {dateLabel(current, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="week-strip" aria-label="Select a day">
                          {data.week.map((date) => {
                            const s = score(data.goals, data.checkins, date);
                            return (
                              <button
                                key={date}
                                onClick={() => setDay(date)}
                                className={`${current === date ? "selected" : ""} ${date === data.today ? "is-today" : ""}`}
                                aria-pressed={current === date}
                              >
                                <span>
                                  {dateLabel(date, { weekday: "short" })}
                                </span>
                                <strong>
                                  {dateLabel(date, { day: "numeric" })}
                                </strong>
                                <span className="day-indicator">
                                  {date < data.today &&
                                  s.total &&
                                  s.complete === s.total ? (
                                    <Check size={11} />
                                  ) : date === data.today ? (
                                    <span />
                                  ) : (
                                    ""
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div
                          className="filter-row"
                          aria-label="Filter commitments"
                        >
                          {[
                            "All",
                            ...categories.filter((c) =>
                              due.some((g) => g.category === c),
                            ),
                          ].map((c) => (
                            <button
                              key={c}
                              onClick={() => setFilter(c)}
                              className={filter === c ? "selected" : ""}
                              aria-pressed={filter === c}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        {!isToday && (
                          <p className="inline-note">
                            {current > data.today
                              ? "A look ahead. Check-ins open on the scheduled day."
                              : "Your recorded progress. Today's check-ins are ready when you are."}
                          </p>
                        )}
                        <div className="task-list">
                          {shown.map((g) => {
                            const entry = data.checkins.find(
                              (c) => c.goal_id === g.id && c.date === current,
                            );
                            const done = credit(g, entry?.value) === 1;
                            return (
                              <article
                                className={`task-row ${done ? "done" : ""}`}
                                key={g.id}
                              >
                                <button
                                  className={`task-check ${done ? "checked" : ""}`}
                                  disabled={busy || !isToday}
                                  aria-label={`${done ? "Undo" : "Check in for"} ${g.title}`}
                                  onClick={() => {
                                    if (g.kind === "binary")
                                      void act(
                                        {
                                          action: "checkin",
                                          goalId: g.id,
                                          date: current,
                                          value: done ? null : 1,
                                        },
                                        done
                                          ? "Check-in cleared"
                                          : "Promise kept. Nice work.",
                                      );
                                    else open({ type: "checkin", goal: g });
                                  }}
                                >
                                  {done ? (
                                    <Check size={17} />
                                  ) : g.kind !== "binary" && entry ? (
                                    <span className="partial-dot" />
                                  ) : null}
                                </button>
                                <CategoryIcon category={g.category} />
                                <div className="task-content">
                                  <h3>{g.title}</h3>
                                  <div className="task-meta">
                                    <span>{g.category}</span>
                                    <span>·</span>
                                    <span>
                                      {g.kind === "binary"
                                        ? `By ${g.due_time}`
                                        : `${entry?.value?.toLocaleString() ?? "—"} / ${targetLabel(g)}`}
                                    </span>
                                    <span className="task-privacy">
                                      {g.group_id ? (
                                        <Users size={12} />
                                      ) : (
                                        <LockKeyhole size={12} />
                                      )}{" "}
                                      {g.group_id
                                        ? "Shared status"
                                        : "Only you"}
                                    </span>
                                  </div>
                                </div>
                                {done ? (
                                  <span className="done-label">
                                    Kept <Check size={13} />
                                  </span>
                                ) : (
                                  <button
                                    className="checkin-link"
                                    disabled={busy || !isToday}
                                    onClick={() =>
                                      open({ type: "checkin", goal: g })
                                    }
                                  >
                                    {entry ? "Update" : "Check in"}
                                    <ArrowUpRight size={14} />
                                  </button>
                                )}
                              </article>
                            );
                          })}
                        </div>
                        {!shown.length && (
                          <Empty
                            title={
                              due.length
                                ? "Nothing in this category"
                                : "A little breathing room"
                            }
                          >
                            {due.length
                              ? "Choose another filter to see your commitments."
                              : "No commitments scheduled for this day. Rest counts, too."}
                          </Empty>
                        )}
                        <button
                          className="add-task"
                          onClick={() => open({ type: "goal" })}
                        >
                          <Plus size={17} />
                          Make a new promise
                          <span>Keep it small. Make it yours.</span>
                        </button>
                      </section>
                    </div>
                    <aside className="day-secondary">
                      <section className="crew-note">
                        <div className="note-top">
                          <span className="eyebrow">
                            A WORD FROM YOUR CORNER
                          </span>
                          <Sparkles size={18} />
                        </div>
                        <span className="quote-mark" aria-hidden="true">
                          “
                        </span>
                        <blockquote>
                          {today.complete === today.total && today.total
                            ? "You did the thing. All the things, actually. We'll allow a little victory lap."
                            : "Your future self called. Said thanks for showing up today."}
                        </blockquote>
                        <div className="note-bottom">
                          <span className="tiny-star" aria-hidden="true">
                            ✳
                          </span>
                          <span>
                            Your AdAstra crew{" "}
                            <small>Automated encouragement</small>
                          </span>
                        </div>
                      </section>
                      <section className="week-summary">
                        <div className="section-heading">
                          <h3>The week, so far</h3>
                          <ArrowDownRight size={17} />
                        </div>
                        <div className="week-numbers">
                          <strong>
                            {weekDone}
                            <span> / {weekTotal}</span>
                          </strong>
                          <span>promises kept</span>
                        </div>
                        <div className="week-chart">
                          {data.week.map((date) => {
                            const s = score(data.goals, data.checkins, date);
                            return (
                              <div key={date}>
                                <div
                                  className={`bar-track ${date > data.today ? "future" : ""}`}
                                >
                                  <span
                                    style={{
                                      height: `${date > data.today ? 0 : s.percent}%`,
                                    }}
                                  />
                                </div>
                                <small
                                  className={
                                    date === data.today ? "current" : ""
                                  }
                                >
                                  {dateLabel(date, { weekday: "narrow" })}
                                </small>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          className="text-link"
                          onClick={() => navigate("calendar")}
                        >
                          See the bigger picture
                          <ArrowRight size={15} />
                        </button>
                      </section>
                      <section className="crew-preview">
                        <div className="section-heading">
                          <h3>Better, together</h3>
                          <Users size={17} />
                        </div>
                        <div className="avatar-stack">
                          {data.members.slice(0, 5).map((m, i) => (
                            <span
                              key={m.id}
                              className={`avatar color-${i % 4}`}
                              title={m.name}
                            >
                              {initials(m.name)}
                            </span>
                          ))}
                        </div>
                        <p>
                          {data.members.length}{" "}
                          {data.members.length === 1 ? "person" : "people"}. A
                          shared reason to show up.
                        </p>
                        <button
                          className="text-link"
                          onClick={() => navigate("groups")}
                        >
                          Check on your crew
                          <ArrowRight size={15} />
                        </button>
                      </section>
                      <p className="quiet-note">
                        <LockKeyhole size={14} />
                        Your details stay yours. Your crew sees only what you
                        choose to share.
                      </p>
                    </aside>
                  </div>
                </>
              )}
              {tab === "goals" && (
                <>
                  <PageHeading
                    eyebrow="INTENTION, MEET ACTION"
                    title="Promises worth keeping."
                    description="Make them specific. Make them doable. Make them yours."
                    action={newGoalButton}
                  />
                  <div className="goals-grid">
                    {data.goals.map((g) => (
                      <article className="goal-card" key={g.id}>
                        <div className="goal-card-top">
                          <CategoryIcon category={g.category} />
                          <span className="eyebrow">{g.category}</span>
                          <button
                            className="icon-button"
                            aria-label={`Archive ${g.title}`}
                            onClick={() => open({ type: "archive", goal: g })}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <h2>{g.title}</h2>
                        <p>{targetLabel(g)}</p>
                        <div
                          className="schedule-days"
                          aria-label="Scheduled weekdays"
                        >
                          {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                            <span
                              key={n}
                              className={
                                g.days.split(",").includes(String(n))
                                  ? "on"
                                  : ""
                              }
                              title={weekdays[n]}
                            >
                              {weekdays[n][0]}
                            </span>
                          ))}
                          <small>{g.due_time}</small>
                        </div>
                        <footer>
                          {g.group_id ? (
                            <>
                              <Users size={14} />
                              {
                                data.groups.find((x) => x.id === g.group_id)
                                  ?.name
                              }
                              <span>Status only</span>
                            </>
                          ) : (
                            <>
                              <LockKeyhole size={14} />
                              Private goal<span>Only you</span>
                            </>
                          )}
                        </footer>
                      </article>
                    ))}
                    <button
                      className="new-goal-card"
                      onClick={() => open({ type: "goal" })}
                    >
                      <span>
                        <Plus size={24} />
                      </span>
                      <strong>A little more intention.</strong>
                      <small>Add a goal that matters to you.</small>
                    </button>
                  </div>
                </>
              )}
              {tab === "calendar" && (
                <>
                  <PageHeading
                    eyebrow="THE BIGGER PICTURE"
                    title="Give your week some shape."
                    description="A little structure, with room for real life."
                    action={newGoalButton}
                  />
                  <section className="calendar-panel">
                    <div className="section-heading">
                      <h2>
                        {dateLabel(data.week[0], {
                          month: "long",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {dateLabel(data.week[6], {
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h2>
                      <span className="small-tag">This week</span>
                    </div>
                    <div className="calendar-grid">
                      {data.week.map((date) => (
                        <section
                          key={date}
                          className={`calendar-day ${date === data.today ? "current" : ""}`}
                        >
                          <header>
                            <span>{dateLabel(date, { weekday: "short" })}</span>
                            <strong>
                              {dateLabel(date, { day: "numeric" })}
                            </strong>
                            {date === data.today && <small>TODAY</small>}
                          </header>
                          <div>
                            {data.goals
                              .filter((g) => dueOn(g, date))
                              .map((g) => {
                                const c = data.checkins.find(
                                  (c) => c.goal_id === g.id && c.date === date,
                                );
                                return (
                                  <button
                                    className={`calendar-event event-${g.category.toLowerCase()}`}
                                    key={g.id}
                                    onClick={() => {
                                      setDay(date);
                                      navigate("today");
                                    }}
                                  >
                                    <span>
                                      {g.due_time}
                                      {credit(g, c?.value) === 1 && (
                                        <Check size={12} />
                                      )}
                                    </span>
                                    <strong>{g.title}</strong>
                                  </button>
                                );
                              })}
                            {!data.goals.some((g) => dueOn(g, date)) && (
                              <p className="rest-day">Room to breathe</p>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                  <div className="integration-strip">
                    <CalendarDays size={23} />
                    <div>
                      <strong>Your calendar, connected. Soon.</strong>
                      <p>
                        Google Calendar and Apple subscriptions are planned.
                        This local calendar works independently.
                      </p>
                    </div>
                    <span className="small-tag">Future integration</span>
                  </div>
                </>
              )}
              {tab === "groups" && (
                <>
                  <PageHeading
                    eyebrow="YOUR PEOPLE, IN YOUR CORNER"
                    title="Progress loves company."
                    description="Shared commitments. A little friendly pressure. A lot of support."
                    action={
                      canManage ? (
                        <button
                          className="primary"
                          onClick={() => open({ type: "group" })}
                        >
                          <Plus size={16} />
                          New group
                        </button>
                      ) : undefined
                    }
                  />
                  <div className="group-tabs">
                    {data.groups.map((g) => (
                      <button
                        className={currentGroup?.id === g.id ? "selected" : ""}
                        key={g.id}
                        onClick={() => setGroup(g.id)}
                      >
                        <Users size={16} />
                        {g.name}
                        <span>{g.member_count}</span>
                      </button>
                    ))}
                  </div>
                  {currentGroup && (
                    <section className="group-panel">
                      <div className="group-banner">
                        <span className="group-emblem">
                          <Users size={29} />
                        </span>
                        <div>
                          <h2>{currentGroup.name}</h2>
                          <p>{currentGroup.description}</p>
                        </div>
                        {currentGroup.joined ? (
                          <span className="membership-badge">
                            <Check size={14} />
                            You're in
                          </span>
                        ) : (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              act(
                                {
                                  action: "joinGroup",
                                  groupId: currentGroup.id,
                                },
                                "Welcome to the crew.",
                              )
                            }
                          >
                            Join group
                          </button>
                        )}
                      </div>
                      <div className="section-heading">
                        <h3>The crew's check-in</h3>
                        <span>Today · shared status only</span>
                      </div>
                      {!currentGroup.joined ? (
                        <Empty
                          icon={LockKeyhole}
                          title="Join the crew to see their progress"
                        >
                          Member commitments are visible to fellow group
                          members.
                        </Empty>
                      ) : (
                        <div className="member-cards">
                          {data.members
                            .filter((m) => m.groups.includes(currentGroup.id))
                            .map((m, i) => (
                              <article className="member-card" key={m.id}>
                                <header>
                                  <span className={`avatar color-${i % 4}`}>
                                    {initials(m.name)}
                                  </span>
                                  <div>
                                    <h3>
                                      {m.name}
                                      {m.id === data.me.id && (
                                        <small>you</small>
                                      )}
                                    </h3>
                                    <span>{m.role}</span>
                                  </div>
                                </header>
                                <div className="member-promises">
                                  {m.shared.some(
                                    (s) => s.groupId === currentGroup.id,
                                  ) ? (
                                    m.shared
                                      .filter(
                                        (s) => s.groupId === currentGroup.id,
                                      )
                                      .map((s, j) => (
                                        <div key={j}>
                                          <span
                                            className={`status-dot ${s.status === "complete" ? "complete" : ""}`}
                                          />
                                          <span>{s.label}</span>
                                          <small>
                                            {s.status === "complete"
                                              ? "Kept"
                                              : s.status === "in progress"
                                                ? "In progress"
                                                : "Not logged"}
                                          </small>
                                        </div>
                                      ))
                                  ) : (
                                    <p className="muted">
                                      No shared commitments due today.
                                    </p>
                                  )}
                                </div>
                              </article>
                            ))}
                        </div>
                      )}
                      <footer className="privacy-banner">
                        <ShieldCheck size={19} />
                        <span>
                          Progress is shared. Personal details aren't. Exact
                          numbers, journal content, and private goals stay with
                          their owner.
                        </span>
                      </footer>
                    </section>
                  )}
                </>
              )}
              {tab === "organization" && (
                <>
                  <PageHeading
                    eyebrow="A HOME FOR YOUR AMBITION"
                    title={data.org!.name}
                    description={data.org!.description}
                    action={
                      <button
                        className="primary"
                        onClick={() => open({ type: "org" })}
                      >
                        <Plus size={16} />
                        New organization
                      </button>
                    }
                  />
                  <div className="org-summary">
                    <div>
                      <Building2 size={22} />
                      <strong>{data.groups.length}</strong>
                      <span>accountability groups</span>
                    </div>
                    <div>
                      <Users size={22} />
                      <strong>{data.members.length}</strong>
                      <span>members</span>
                    </div>
                    <div>
                      <ShieldCheck size={22} />
                      <strong className="role-value">{data.org!.role}</strong>
                      <span>your organization role</span>
                    </div>
                  </div>
                  <section className="table-panel">
                    <div className="section-heading">
                      <div>
                        <h2>People & permissions</h2>
                        <p>One organization. Different ways to contribute.</p>
                      </div>
                      {canManage && (
                        <button
                          className="secondary"
                          onClick={() => open({ type: "invite" })}
                        >
                          <Plus size={16} />
                          Invite someone
                        </button>
                      )}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Organization role</th>
                            <th>Groups</th>
                            <th>Personal data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.members.map((m, i) => (
                            <tr key={m.id}>
                              <td>
                                <span className={`avatar small color-${i % 4}`}>
                                  {initials(m.name)}
                                </span>
                                <strong>{m.name}</strong>
                                {m.id === data.me.id && (
                                  <span className="muted">(you)</span>
                                )}
                              </td>
                              <td>
                                <span className={`role-badge role-${m.role}`}>
                                  {m.role}
                                </span>
                              </td>
                              <td>{m.groups.length}</td>
                              <td>
                                <LockKeyhole size={13} />
                                Private
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <div className="role-explainer">
                    <article>
                      <span>01</span>
                      <h3>Owner</h3>
                      <p>
                        Creates groups and invites members or administrators.
                        Personal goals remain private.
                      </p>
                    </article>
                    <article>
                      <span>02</span>
                      <h3>Administrator</h3>
                      <p>
                        Creates groups and invites members. Supports the
                        organization without access to private details.
                      </p>
                    </article>
                    <article>
                      <span>03</span>
                      <h3>Member</h3>
                      <p>
                        Joins groups, manages personal goals, and chooses what
                        progress to share.
                      </p>
                    </article>
                  </div>
                  {data.invites.length > 0 && (
                    <section className="table-panel invites-panel">
                      <h3>Open invitations</h3>
                      <p className="muted">
                        Single-use codes. Share locally; no email is sent.
                      </p>
                      {data.invites.map((i) => (
                        <div className="invite-row" key={i.id}>
                          <code>{i.token}</code>
                          <span>{i.role}</span>
                          <small>
                            Expires{" "}
                            {dateLabel(i.expires_at.slice(0, 10), {
                              month: "short",
                              day: "numeric",
                            })}
                          </small>
                          <button
                            className="text-button"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(i.token)
                                .then(() => setToast("Invite code copied"))
                                .catch(() =>
                                  setError(
                                    "Couldn't copy automatically. Select and copy the code.",
                                  ),
                                )
                            }
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                  <button
                    className="text-link"
                    onClick={() => open({ type: "join" })}
                  >
                    Have an invitation to another organization?
                    <ArrowRight size={15} />
                  </button>
                </>
              )}
              {tab === "inbox" && (
                <>
                  <PageHeading
                    eyebrow="A LITTLE NUDGE. A LITTLE LOVE."
                    title="Your corner of encouragement."
                    description="Private messages, written around your actual follow-through."
                    action={
                      <button
                        className="secondary"
                        disabled={busy || !!data.me.paused}
                        onClick={() =>
                          act(
                            { action: "generateMessage", kind: "daily" },
                            "Daily message is ready. One per day.",
                          )
                        }
                      >
                        <Sparkles size={16} />
                        Generate daily check-in
                      </button>
                    }
                  />
                  <div className="inbox-layout">
                    <section className="message-list">
                      {data.messages.map((m) => (
                        <article
                          className={`message-card ${!m.read ? "unread" : ""}`}
                          key={m.id}
                        >
                          <header>
                            <span
                              className={`message-icon ${m.kind === "weekly" ? "weekly" : ""}`}
                            >
                              {m.kind === "weekly" ? (
                                <Heart size={21} />
                              ) : (
                                <Sparkles size={21} />
                              )}
                            </span>
                            <div>
                              <span className="eyebrow">
                                {m.kind === "weekly"
                                  ? "THE WEEKLY RESET"
                                  : m.kind === "daily"
                                    ? "DAILY ACCOUNTABILITY"
                                    : "WELCOME TO YOUR CREW"}
                              </span>
                              <h2>{m.subject}</h2>
                            </div>
                            {!m.read && <span className="unread-dot" />}
                          </header>
                          <p>{m.body}</p>
                          <footer>
                            <span>
                              {dateLabel(m.date, {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              · Automated · Only you
                            </span>
                            <div>
                              {!!m.email_preview && (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    open({ type: "email", message: m })
                                  }
                                >
                                  Email preview
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                              {!m.read && (
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() =>
                                    act(
                                      { action: "markRead", id: m.id },
                                      "Marked as read",
                                    )
                                  }
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </footer>
                        </article>
                      ))}
                      {!data.messages.length && (
                        <Empty icon={Inbox} title="A quiet corner, for now">
                          Your daily check-ins and weekly encouragement will
                          appear here.
                        </Empty>
                      )}
                    </section>
                    <aside className="inbox-aside">
                      <span className="tiny-star" aria-hidden="true">
                        ✳
                      </span>
                      <h2>Progress deserves a little perspective.</h2>
                      <p>
                        The weekly reset celebrates what worked and gives the
                        next week a fresh start.
                      </p>
                      <button
                        className="secondary"
                        disabled={busy || !!data.me.paused}
                        onClick={() =>
                          act(
                            { action: "generateMessage", kind: "weekly" },
                            "Your weekly preview is ready.",
                          )
                        }
                      >
                        Preview weekly reset
                        <ArrowRight size={16} />
                      </button>
                      <div className="aside-divider" />
                      <LockKeyhole size={19} />
                      <p>
                        Messages stay private. Email previews never leave this
                        computer.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => navigate("settings")}
                      >
                        Set your tone
                        <ArrowRight size={15} />
                      </button>
                    </aside>
                  </div>
                </>
              )}
              {tab === "settings" && (
                <>
                  <PageHeading
                    eyebrow="ACCOUNTABILITY, ON YOUR TERMS"
                    title="Make this space yours."
                    description="A little structure should fit your life, not the other way around."
                  />
                  <form
                    className="settings-layout"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act(
                        {
                          action: "settings",
                          name: f.get("name"),
                          timezone: f.get("timezone"),
                          tone: f.get("tone"),
                          cutoff: f.get("cutoff"),
                          paused: f.has("paused"),
                          emailPreview: f.has("emailPreview"),
                        },
                        "Your preferences are saved.",
                      );
                    }}
                  >
                    <div>
                      <section className="settings-panel">
                        <h2>Your profile</h2>
                        <div className="form-grid">
                          <label>
                            Display name
                            <input
                              name="name"
                              required
                              maxLength={80}
                              defaultValue={data.me.name}
                            />
                          </label>
                          <label>
                            Time zone
                            <select
                              name="timezone"
                              defaultValue={data.me.timezone}
                            >
                              {[
                                ...new Set([
                                  data.me.timezone,
                                  "America/Los_Angeles",
                                  "America/Denver",
                                  "America/Chicago",
                                  "America/New_York",
                                  "Europe/London",
                                  "Europe/Paris",
                                  "Asia/Tokyo",
                                  "Australia/Sydney",
                                  "UTC",
                                ]),
                              ].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </section>
                      <section className="settings-panel">
                        <h2>Your accountability style</h2>
                        <p className="muted">
                          Keep the honesty. Choose the delivery.
                        </p>
                        <div className="tone-options">
                          {[
                            {
                              id: "supportive",
                              name: "Supportive",
                              text: "Gentle nudges. Always in your corner.",
                            },
                            {
                              id: "light",
                              name: "Light roast",
                              text: "A little cheek. A lot of belief in you.",
                            },
                            {
                              id: "banter",
                              name: "Friendly banter",
                              text: "Your boys have entered the chat.",
                            },
                          ].map((t) => (
                            <label key={t.id}>
                              <input
                                type="radio"
                                name="tone"
                                value={t.id}
                                defaultChecked={data.me.tone === t.id}
                              />
                              <span>
                                <strong>{t.name}</strong>
                                <small>{t.text}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                        <label className="cutoff-label">
                          Daily check-in time
                          <input
                            name="cutoff"
                            type="time"
                            required
                            defaultValue={data.me.cutoff}
                          />
                          <small>
                            In your selected time zone. The local scheduler
                            checks once a minute while the production app is
                            running.
                          </small>
                        </label>
                        <label className="toggle-row">
                          <span>
                            <strong>Take a breather</strong>
                            <small>
                              Pause automatic messages and message previews.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            name="paused"
                            defaultChecked={!!data.me.paused}
                          />
                        </label>
                        <label className="toggle-row">
                          <span>
                            <strong>Email previews</strong>
                            <small>
                              Create a local email preview for new messages.
                              Nothing is sent.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            name="emailPreview"
                            defaultChecked={!!data.me.email_preview}
                          />
                        </label>
                      </section>
                      <button className="primary" disabled={busy} type="submit">
                        {busy ? "Saving…" : "Save preferences"}
                        <Check size={16} />
                      </button>
                    </div>
                    <aside>
                      <section className="settings-panel">
                        <h2>Connected accounts</h2>
                        <div className="connection">
                          <GoogleMark />
                          <div>
                            <strong>Google sign-in</strong>
                            <small>
                              {data.googleEnabled
                                ? "Configured · available on sign-in"
                                : "Ready for credentials"}
                            </small>
                          </div>
                          <span className="small-tag">
                            {data.googleEnabled ? "Enabled" : "Not connected"}
                          </span>
                        </div>
                        <p className="helper">
                          Google sign-in is separate from calendar access.
                          Connecting accounts is optional for this local
                          prototype.
                        </p>
                        <div className="connection">
                          <CalendarDays size={20} />
                          <div>
                            <strong>Google / Apple Calendar</strong>
                            <small>Planned integration</small>
                          </div>
                        </div>
                        <div className="connection">
                          <Activity size={20} />
                          <div>
                            <strong>Apple Health, Strava, Garmin</strong>
                            <small>Future phase</small>
                          </div>
                        </div>
                      </section>
                      <section className="settings-panel privacy-settings">
                        <ShieldCheck size={24} />
                        <h2>Private by default.</h2>
                        <p>
                          Friends see the commitments you share and whether you
                          kept them. Exact nutrition figures, money amounts, and
                          private reflections stay yours.
                        </p>
                        <p>
                          Owners and administrators have the same privacy
                          boundaries.
                        </p>
                      </section>
                    </aside>
                  </form>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Small steps. Higher places.</span>
            <span>
              AD ASTRA <span aria-hidden="true">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          title={
            {
              goal: "Make a new promise.",
              org: "A home for your people.",
              group: "Find your crew.",
              invite: "Bring someone along.",
              join: "Join your people.",
              checkin: "A little honest check-in.",
              archive: "Retire this goal?",
              email: "An email, without the send.",
              help: "Your local starting point.",
            }[modal.type]
          }
          onClose={() => setModal(null)}
        >
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          {modal.type === "goal" && (
            <GoalForm
              groups={joined}
              busy={busy}
              onSave={async (values) => {
                if (
                  await act(
                    { action: "createGoal", orgId: data.org!.id, ...values },
                    "A new promise. A fresh start.",
                  )
                )
                  setModal(null);
              }}
            />
          )}
          {(modal.type === "org" || modal.type === "group") && (
            <form
              onSubmit={(e) =>
                submit(
                  e,
                  modal.type === "org" ? "createOrg" : "createGroup",
                  modal.type === "group" ? { orgId: data.org!.id } : {},
                )
              }
            >
              <p className="muted">
                {modal.type === "org"
                  ? "Organizations hold your groups and members. Each has its own privacy boundary."
                  : "A smaller circle inside your organization, built around shared ambition."}
              </p>
              <label>
                Name
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder={
                    modal.type === "org"
                      ? "e.g. original"
                      : "e.g. The Morning Crew"
                  }
                />
              </label>
              <label>
                A few words about it
                <textarea
                  name="description"
                  maxLength={240}
                  placeholder="What brings your people together?"
                />
              </label>
              <button className="primary full-width" disabled={busy}>
                Create {modal.type === "org" ? "organization" : "group"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "invite" && (
            <form
              onSubmit={(e) =>
                submit(e, "createInvite", { orgId: data.org!.id })
              }
            >
              <p className="muted">
                Create a single-use code, valid for seven days. Your friend can
                enter it from their Organization page. No email is sent.
              </p>
              <label>
                Organization role
                <select name="role">
                  <option value="member">Member — goals and groups</option>
                  {data.org?.role === "owner" && (
                    <option value="admin">
                      Administrator — manage groups and invite members
                    </option>
                  )}
                </select>
              </label>
              <button className="primary full-width" disabled={busy}>
                Create invitation
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "join" && (
            <form onSubmit={(e) => submit(e, "acceptInvite")}>
              <p className="muted">
                Paste the invitation code your organization's owner or
                administrator shared with you.
              </p>
              <label>
                Invitation code
                <input
                  name="token"
                  required
                  maxLength={100}
                  autoComplete="off"
                  placeholder="Paste your code"
                />
              </label>
              <button className="primary full-width" disabled={busy}>
                Join organization
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "checkin" && (
            <CheckinForm
              goal={modal.goal}
              value={
                data.checkins.find(
                  (c) => c.goal_id === modal.goal.id && c.date === data.today,
                )?.value
              }
              busy={busy}
              onSave={async (value) => {
                if (
                  await act(
                    {
                      action: "checkin",
                      goalId: modal.goal.id,
                      date: data.today,
                      value,
                    },
                    value === null
                      ? "Check-in cleared"
                      : "Check-in saved. Thanks for showing up.",
                  )
                )
                  setModal(null);
              }}
            />
          )}
          {modal.type === "archive" && (
            <>
              <p className="muted">
                “{modal.goal.title}” will leave your active plan. Its check-in
                records stay in the local database. Active-plan summaries will
                no longer include it.
              </p>
              <div className="button-row">
                <button className="secondary" onClick={() => setModal(null)}>
                  Keep goal
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act(
                        { action: "archiveGoal", goalId: modal.goal.id },
                        "Goal retired",
                      )
                    )
                      setModal(null);
                  }}
                >
                  Retire goal
                </button>
              </div>
            </>
          )}
          {modal.type === "email" && (
            <div className="email-preview">
              <div className="email-envelope">
                <span>
                  <strong>From</strong>AdAstra · Your crew
                  &lt;crew@mail.example.test&gt;
                </span>
                <span>
                  <strong>To</strong>
                  {data.me.email}
                </span>
                <span>
                  <strong>Subject</strong>
                  {modal.message.subject}
                </span>
              </div>
              <div className="email-body">
                <Compass size={26} />
                <h2>{modal.message.subject}</h2>
                <p>{modal.message.body}</p>
                <span className="email-cta">Open your AdAstra inbox →</span>
                <small>
                  Automated encouragement. Your preferences, your pace.
                </small>
              </div>
              <p className="helper">
                Local preview only. This sender is a placeholder, not a
                provisioned mailbox.
              </p>
            </div>
          )}
          {modal.type === "help" && (
            <div className="help-copy">
              <p>
                AdAstra is your local space for accountability. The sample
                profiles let you explore owner and member views.
              </p>
              <p>
                <strong>Try the loop:</strong> create a goal, check in, visit
                your group, then generate a private message in Inbox.
              </p>
              <p>
                SQLite keeps changes on this computer. Docker runs a small
                scheduler for daily messages. Google sign-in is optional and
                needs your own credentials.
              </p>
              <p className="helper">
                This demo is designed for localhost. Profile switching is
                intentionally available for testing. Calendar and fitness
                connections, real emails, and public hosting come later.
              </p>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function GoalForm({
  groups,
  busy,
  onSave,
}: {
  groups: Snapshot["groups"];
  busy: boolean;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState("binary"),
    [sharing, setSharing] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          title: f.get("title"),
          sharedLabel: f.get("sharedLabel") || f.get("title"),
          category: f.get("category"),
          kind,
          target: kind === "binary" ? 1 : Number(f.get("target")),
          targetMax: kind === "range" ? Number(f.get("targetMax")) : null,
          unit: kind === "binary" ? "session" : f.get("unit"),
          days: f.getAll("days").map(Number),
          dueTime: f.get("dueTime"),
          groupId: sharing || null,
        });
      }}
    >
      <p className="muted">
        Pick something that matters. Small enough to do, meaningful enough to
        keep.
      </p>
      <label>
        Your promise
        <input
          name="title"
          required
          maxLength={80}
          placeholder="e.g. Take a walk before the first meeting"
        />
      </label>
      <div className="form-grid">
        <label>
          Area of life
          <select name="category">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          How to measure it
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="binary">Done / not done</option>
            <option value="quantity">Build toward a target</option>
            <option value="range">Stay within a range</option>
          </select>
        </label>
      </div>
      {kind !== "binary" && (
        <div className="form-grid">
          <label>
            {kind === "range" ? "Lower target" : "Target"}
            <input
              type="number"
              name="target"
              required
              min="0.01"
              max="1000000000"
              step="any"
              placeholder="30"
            />
          </label>
          {kind === "range" && (
            <label>
              Upper target
              <input
                type="number"
                name="targetMax"
                required
                min="0.01"
                max="1000000000"
                step="any"
                placeholder="60"
              />
            </label>
          )}
          <label>
            Unit
            <input
              name="unit"
              maxLength={20}
              required
              placeholder="minutes, steps, dollars…"
            />
          </label>
        </div>
      )}
      <fieldset>
        <legend>Make time for it</legend>
        <div className="day-inputs">
          {[1, 2, 3, 4, 5, 6, 0].map((n) => (
            <label key={n}>
              <input type="checkbox" name="days" value={n} defaultChecked />
              <span>{weekdays[n]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <label>
          Daily deadline
          <input type="time" name="dueTime" defaultValue="20:00" required />
        </label>
        <label>
          Who sees your status?
          <select value={sharing} onChange={(e) => setSharing(e.target.value)}>
            <option value="">Only me — private</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {sharing && (
        <label>
          Shared label
          <input
            name="sharedLabel"
            maxLength={80}
            required
            placeholder="e.g. Daily movement"
          />
          <small>
            Friends see this label and completion status. Your title and exact
            numbers stay private.
          </small>
        </label>
      )}
      <button className="primary full-width" disabled={busy}>
        Make the promise
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function CheckinForm({
  goal,
  value,
  busy,
  onSave,
}: {
  goal: Goal;
  value?: number;
  busy: boolean;
  onSave: (value: number | null) => Promise<void>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave(Number(f.get("value")));
      }}
    >
      <div className="checkin-goal">
        <CategoryIcon category={goal.category} />
        <div>
          <h3>{goal.title}</h3>
          <p>{targetLabel(goal)}</p>
        </div>
      </div>
      {goal.kind === "binary" ? (
        <div className="binary-options">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => onSave(1)}
          >
            <Check size={17} />I did it
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => onSave(0)}
          >
            Didn't happen today
          </button>
        </div>
      ) : (
        <>
          <label>
            What did you get to?
            <input
              type="number"
              name="value"
              min="0"
              max="1000000000"
              step="any"
              defaultValue={value ?? ""}
              required
              placeholder={`Your ${goal.unit}`}
            />
          </label>
          <p className="helper">
            {goal.kind === "range"
              ? "Credit is based on your chosen range. Lower isn't automatically better."
              : "Partial progress counts. Credit tops out at your target."}
          </p>
          <button className="primary full-width" disabled={busy}>
            Save check-in
            <Check size={16} />
          </button>
        </>
      )}
      <p className="privacy-note">
        <LockKeyhole size={15} />
        {goal.group_id
          ? "Your crew sees status only, never the exact amount."
          : "This check-in is visible only to you."}
      </p>
      {value !== undefined && (
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => onSave(null)}
        >
          Clear this check-in
        </button>
      )}
    </form>
  );
}
