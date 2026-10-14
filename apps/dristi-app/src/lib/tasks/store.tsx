"use client";

/**
 * The tasks store: one provider for the whole `/tasks` area.
 *
 * Loads people, cases and tasks from the repository (seeding the sandbox on first run),
 * knows who the current person is, and applies transitions through `dispatch`. Every
 * change is written through the repository and announced on a `BroadcastChannel`, so
 * a second tab — signed in as someone else — sees it at once. `online` mirrors the
 * browser; when it is false the screens disable every verb and nothing is optimistic.
 */

import * as React from "react";

import { getRepository } from "./data";
import { browserCourt } from "@/lib/court/browser";
import { buildTasks, CASES, DEFAULT_USER_ID, PEOPLE, SEED_VERSION } from "./sandbox";
import { tasksForCourt } from "./court-tasks";
import { type Ctx, type Transition, TransitionError } from "./transitions";
import type { Case, Person, PersonId, Task, TaskId } from "./types";

const CHANNEL = "dristi-tasks";
/** Which seed this browser holds; an older one is wiped and re-seeded on load. */
const SEED_KEY = "dristi-tasks:seed";

/** The local calendar day, as YYYY-M-D. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * The stamp a seeded browser carries: the seed version, the day it was seeded, and
 * a signature of the seed's size. The sandbox bakes each hearing's absolute time at
 * seed, so a browser seeded yesterday shows an empty "today"; folding the day in
 * makes a new day reseed on the next load, as a version bump does. Folding the
 * people/case counts in makes *adding or removing* fixture matters (say, more of
 * the court docket) reseed on its own — without waiting for a matching SEED_VERSION
 * bump, which is easy to forget or to land a moment after the data and leave a
 * browser stamped current on incomplete data.
 */
function seedStamp(): string {
  return `${SEED_VERSION}@${todayKey()}@${PEOPLE.length}x${CASES.length}`;
}

function seedIsCurrent(): boolean {
  try {
    return localStorage.getItem(SEED_KEY) === seedStamp();
  } catch {
    return true;
  }
}

/**
 * **The demo starts fresh on every page load** (owner, 2026-10-14: "if I refresh the
 * page, all the pending tasks come back"). It is sample data for showing flows, so a
 * refresh puts every task back as seeded — whatever was paid, signed or filed in the
 * last run. Within a page's life the sandbox keeps what was done, so a flow can be
 * walked through screen to screen; only a full load starts it again.
 *
 * Set to false to keep a browser's sandbox across loads (it then reseeds only when the
 * seed stamp changes, as before).
 */
const RESEED_ON_PAGE_LOAD = true;
let reseededThisPage = false;

function rememberSeed(): void {
  try {
    localStorage.setItem(SEED_KEY, seedStamp());
  } catch {
    /* private mode; nothing to do */
  }
}

type LoadState = "loading" | "ready" | "error";

/** A task another tab just closed — kept visible, dimmed, for a moment. */
export type Ghost = { taskId: TaskId; byName: string; at: string };

type Broadcast =
  | { type: "changed"; ids: TaskId[]; byId: PersonId; byName: string; closed: TaskId[] }
  | { type: "reset" };

export type TasksContextValue = {
  state: LoadState;
  error: string | null;
  people: Person[];
  cases: Case[];
  tasks: Task[];
  user: Person;
  online: boolean;
  ghosts: Ghost[];
  /** The row to flash on the next render of the list, with a nonce so repeats flash again. */
  highlight: { taskId: TaskId; nonce: number } | null;
  reload: () => Promise<void>;
  setUser: (id: PersonId) => Promise<void>;
  resetSandbox: () => Promise<void>;
  /** Apply a transition to one task. Throws `TransitionError` on an illegal move. */
  dispatch: (taskId: TaskId, transition: Transition) => Promise<Task>;
  requestHighlight: (taskId: TaskId) => void;
  dismissGhost: (taskId: TaskId) => void;
};

const TasksContext = React.createContext<TasksContextValue | null>(null);

const FALLBACK_USER: Person = PEOPLE.find((p) => p.id === DEFAULT_USER_ID) ?? PEOPLE[0];

function useOnline(): boolean {
  const subscribe = React.useCallback((cb: () => void) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  }, []);
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LoadState>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [cases, setCases] = React.useState<Case[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [userId, setUserId] = React.useState<PersonId>(DEFAULT_USER_ID);
  const [ghosts, setGhosts] = React.useState<Ghost[]>([]);
  const [highlight, setHighlight] = React.useState<{ taskId: TaskId; nonce: number } | null>(null);
  const online = useOnline();
  // Latest values for callbacks that outlive a render (the channel listener).
  const tasksRef = React.useRef<Task[]>([]);
  const userRef = React.useRef<PersonId>(userId);
  React.useEffect(() => {
    tasksRef.current = tasks;
    userRef.current = userId;
  }, [tasks, userId]);

  const user = React.useMemo(
    () => people.find((p) => p.id === userId) ?? FALLBACK_USER,
    [people, userId]
  );

  // The first load starts from the initial "loading" state; `reload` re-enters it.
  const load = React.useCallback(async () => {
    try {
      const repo = getRepository();
      let [ppl, cs, ts] = await Promise.all([repo.listPeople(), repo.listCases(), repo.listTasks()]);
      const freshPage = RESEED_ON_PAGE_LOAD && !reseededThisPage;
      reseededThisPage = true;
      if (ppl.length && (freshPage || !seedIsCurrent())) {
        // A fresh page load (the demo starts over), or the model changed under this
        // browser's data: start again from the seed.
        await repo.clear();
        ppl = [];
      }
      if (ppl.length === 0) {
        // First run in this browser: seed the sandbox.
        ppl = PEOPLE;
        cs = CASES;
        ts = buildTasks();
        await Promise.all([repo.putPeople(ppl), repo.putCases(cs), repo.putTasks(ts)]);
        rememberSeed();
      }
      const uid = (await repo.getCurrentUserId()) ?? DEFAULT_USER_ID;
      // IndexedDB returns rows by key; the team reads in its seeded order (you first).
      const order = (p: Person) => {
        const i = PEOPLE.findIndex((x) => x.id === p.id);
        return i === -1 ? PEOPLE.length : i;
      };
      ppl = [...ppl].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
      setPeople(ppl);
      setCases(cs);
      setTasks(ts);
      setUserId(ppl.some((p) => p.id === uid) ? uid : DEFAULT_USER_ID);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tasks");
      setState("error");
    }
  }, []);

  React.useEffect(() => {
    // Deferred a tick: the effect only starts the read; every setState happens when
    // IndexedDB answers.
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const reload = React.useCallback(async () => {
    setState("loading");
    setError(null);
    await load();
  }, [load]);

  // Cross-tab: another tab changed tasks. Reload them; if any went from open to closed
  // while we were looking, keep the row for a moment as a ghost.
  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = async (event: MessageEvent<Broadcast>) => {
      const msg = event.data;
      if (msg.type === "reset") {
        void reload();
        return;
      }
      if (msg.byId === userRef.current) {
        // Same person in two tabs — just refresh.
        setTasks(await getRepository().listTasks());
        return;
      }
      const fresh = await getRepository().listTasks();
      const before = tasksRef.current;
      const closedNow = msg.closed.filter((id) => {
        const was = before.find((t) => t.id === id);
        return was && !["done", "expired", "obsolete"].includes(was.status);
      });
      setTasks(fresh);
      if (closedNow.length) {
        const at = new Date().toISOString();
        setGhosts((g) => [
          ...g.filter((x) => !closedNow.includes(x.taskId)),
          ...closedNow.map((taskId) => ({ taskId, byName: msg.byName, at })),
        ]);
        window.setTimeout(() => {
          setGhosts((g) => g.filter((x) => !closedNow.includes(x.taskId)));
        }, 6000);
      }
    };
    return () => channel.close();
  }, [reload]);

  const announce = React.useCallback((msg: Broadcast) => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(msg);
    channel.close();
  }, []);

  const dispatch = React.useCallback(
    async (taskId: TaskId, transition: Transition): Promise<Task> => {
      if (!navigator.onLine) {
        throw new TransitionError("forbidden", "You are offline — changes are not queued.");
      }
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) throw new TransitionError("invalid", "That task no longer exists.");
      const kase = cases.find((c) => c.id === task.caseId);
      if (!kase) throw new TransitionError("invalid", "The task's case is missing.");
      const ctx: Ctx = { actor: user, kase, now: new Date().toISOString(), people };
      const result = transition(task, ctx);
      const changed = "created" in result ? [result.task, result.created] : [result];
      const repo = getRepository();
      await repo.putTasks(changed);
      setTasks((prev) => {
        const next = prev.map((t) => changed.find((c) => c.id === t.id) ?? t);
        for (const c of changed) if (!next.some((t) => t.id === c.id)) next.push(c);
        return next;
      });
      const closed = changed
        .filter((t) => ["done", "expired", "obsolete"].includes(t.status))
        .map((t) => t.id);
      announce({ type: "changed", ids: changed.map((t) => t.id), byId: user.id, byName: user.name, closed });
      return "created" in result ? result.task : result;
    },
    [announce, cases, people, user]
  );

  const setUser = React.useCallback(async (id: PersonId) => {
    setUserId(id);
    await getRepository().putCurrentUserId(id);
  }, []);

  const resetSandbox = React.useCallback(async () => {
    const repo = getRepository();
    await repo.clear();
    await reload();
    announce({ type: "reset" });
  }, [announce, reload]);

  const requestHighlight = React.useCallback((taskId: TaskId) => {
    setHighlight((h) => ({ taskId, nonce: (h?.nonce ?? 0) + 1 }));
  }, []);

  const dismissGhost = React.useCallback((taskId: TaskId) => {
    setGhosts((g) => g.filter((x) => x.taskId !== taskId));
  }, []);

  /* What this court's advocates are asked to do (`tasksForCourt`): the sandbox is one
     set for every state, and some of its work does not exist in some states. The court
     is fixed for the page's life — changing it reloads the page. */
  const courtTasks = React.useMemo(() => tasksForCourt(tasks, browserCourt()), [tasks]);

  const value = React.useMemo<TasksContextValue>(
    () => ({
      state,
      error,
      people,
      cases,
      tasks: courtTasks,
      user,
      online,
      ghosts,
      highlight,
      reload,
      setUser,
      resetSandbox,
      dispatch,
      requestHighlight,
      dismissGhost,
    }),
    [state, error, people, cases, courtTasks, user, online, ghosts, highlight, reload, setUser, resetSandbox, dispatch, requestHighlight, dismissGhost]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = React.useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used inside <TasksProvider>");
  return ctx;
}
