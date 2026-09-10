"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  busyLabelFor,
  checkResultMessage,
  messageForResponse,
  NETWORK_UNCERTAIN_MSG,
  PANEL_REFRESHED_MSG,
  REFRESH_SLOW_MSG,
  type ActionMessage,
  type ActionResponse,
} from "./actionMessages";

/** After this long still refreshing, add a "taking longer than usual" hint. */
const REFRESH_SLOW_MS = 6000;

/**
 * Drives `router.refresh()` and reports **real** completion.
 *
 * `router.refresh()` re-fetches the server component and merges the new RSC
 * payload; wrapped in `startTransition`, `useTransition`'s `isPending` stays
 * true until that fresh data has arrived and rendered (Next App Router
 * semantics) — so `busy` is the source of truth for "still refreshing", NOT a
 * timer. The timer only flips `slow` on for a longer-than-usual wait so the UI
 * can say so; it never ends the wait or claims success. `done` is set on the
 * pending true→false edge — i.e. only after a confirmed refresh — and stays set
 * until the next `refresh()` (the caller shows a brief "оновлено" note).
 */
function useRefresh(): {
  busy: boolean;
  slow: boolean;
  done: boolean;
  refresh: () => void;
} {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // `gen` bumps on each refresh; `doneGen`/`slowGen` say which refresh reached
  // that state. All state, so nothing is read off a ref during render.
  const [gen, setGen] = useState(0);
  const [slowGen, setSlowGen] = useState(-1);
  const [doneGen, setDoneGen] = useState(-1);
  const [wasPending, setWasPending] = useState(false);

  const refresh = useCallback(() => {
    setGen((g) => g + 1);
    setSlowGen(-1);
    startTransition(() => router.refresh());
  }, [router]);

  // Completion edge (all-state "detect a change" pattern, no effect): the
  // transition settled -> this refresh is done.
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && !isPending) {
      setSlowGen(-1);
      setDoneGen(gen);
    }
  }

  // The only timer: after a while still pending, surface a "taking longer" hint.
  // It never ends the wait or claims success — `isPending` alone does that.
  useEffect(() => {
    if (!isPending) return;
    const t = setTimeout(() => setSlowGen(gen), REFRESH_SLOW_MS);
    return () => clearTimeout(t);
  }, [isPending, gen]);

  return {
    busy: isPending,
    slow: isPending && slowGen === gen && gen > 0,
    done: !isPending && doneGen === gen && gen > 0,
    refresh,
  };
}

export interface PanelVersions {
  car: string;
  gallery: string;
  service: string;
  contact: string;
  promo: string;
  review: string;
  published: string;
}

type ActionPayload =
  | { action: "confirm-locale"; kind: string; id: string; locale: string }
  | { action: "publish"; kind: string; id: string }
  | { action: "unpublish"; kind: string; id: string }
  | { action: "complete-deletion" };

/** amber/green/red status line, announced to a screen reader. */
function StatusLine({ msg, children }: { msg: ActionMessage; children?: React.ReactNode }) {
  const tone =
    msg.kind === "ok"
      ? "text-green-700 dark:text-green-400"
      : msg.kind === "conflict" || msg.kind === "uncertain"
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-600";
  // "uncertain" and "err" both need attention now — announce them assertively.
  const assertive = msg.kind === "err" || msg.kind === "uncertain";
  return (
    <span
      className={`text-xs ${tone}`}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
    >
      {msg.text}
      {children}
    </span>
  );
}

export function PanelButton({
  payload,
  versions,
  children,
  disabled,
  variant = "default",
  confirmText,
  checkExtra,
}: {
  payload: ActionPayload;
  versions: PanelVersions;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "solid";
  confirmText?: string;
  /** Extra fields the read-only result check needs beyond `payload`
   *  (e.g. `slugs` for complete-deletion). */
  checkExtra?: { slugs?: string[]; planPaths?: string[] };
}) {
  const { busy: refreshing, slow: refreshSlow, done: refreshDone, refresh } = useRefresh();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionMessage | null>(null);
  // Synchronous guard: state only disables on the next render, so two fast
  // clicks — or a click during the post-action refresh — could fire a second
  // request against stale versions. This blocks it immediately.
  const inFlight = useRef(false);
  // Set when a write's outcome is UNKNOWN (lost response, either hop). The
  // action stays locked until a read-only "Перевірити результат" gives a
  // definite yes/no; a `null` ("Результат поки невідомий") keeps it locked.
  const [uncertain, setUncertain] = useState<{ checking: boolean } | null>(null);

  const checkResult = async () => {
    if (uncertain?.checking) return;
    setUncertain({ checking: true });
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-result",
          check: { ...payload, ...checkExtra },
          versions,
        }),
      });
      let data: { applied?: boolean | null; message?: string } | null = null;
      try {
        data = (await res.json()) as { applied?: boolean | null; message?: string };
      } catch {
        data = null;
      }
      if (!data || data.applied === undefined) {
        setUncertain({ checking: false }); // still locked; owner can check again
        setMsg({ kind: "uncertain", text: "Перевірити результат не вдалося — спробуйте ще раз." });
        return;
      }
      const applied = data.applied ?? null;
      const text = data.message ?? checkResultMessage(applied).text;
      setMsg({ kind: applied === true ? "ok" : applied === false ? "conflict" : "uncertain", text });
      if (applied === null) {
        setUncertain({ checking: false }); // "Результат поки невідомий" — keep locked
      } else {
        setUncertain(null); // definite answer — unlock; sync the panel
        refresh();
      }
    } catch {
      setUncertain({ checking: false });
      setMsg({ kind: "uncertain", text: "Перевірити результат не вдалося — спробуйте ще раз." });
    }
  };

  async function run() {
    if (inFlight.current || busy || refreshing || uncertain) return;
    if (confirmText && !window.confirm(confirmText)) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, versions }),
      });
      let data: ActionResponse | null = null;
      try {
        data = (await res.json()) as ActionResponse;
      } catch {
        data = null; // sent, but no structured answer — treat as unknown outcome
      }
      // Lock on EITHER path a write's result can be unknown: the server said so
      // (`outcome:"unknown"`), or no parseable response came back at all.
      if (!data || (!data.ok && data.outcome === "unknown")) {
        setUncertain({ checking: false });
        setMsg(data ? messageForResponse(data) : { kind: "uncertain", text: NETWORK_UNCERTAIN_MSG });
      } else {
        setMsg(messageForResponse(data, data.ok));
        if (data.ok) refresh();
      }
    } catch {
      // No response at all — the write may or may not have landed. Lock this
      // action and make the owner CHECK (read-only) before anything is repeated.
      setUncertain({ checking: false });
      setMsg({ kind: "uncertain", text: NETWORK_UNCERTAIN_MSG });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const base =
    "inline-flex min-h-[36px] items-center gap-1 rounded border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    default: "border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
    primary: "border-amber-600 bg-amber-600 text-white hover:bg-amber-700",
    danger: "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
    solid:
      "border-neutral-800 bg-neutral-800 text-white hover:bg-neutral-700 dark:border-neutral-200 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white",
  }[variant];

  const working = busy || refreshing;
  const label = busy
    ? busyLabelFor(payload.action)
    : refreshing
      ? busyLabelFor("refresh")
      : children;
  const note =
    refreshSlow ? REFRESH_SLOW_MSG : refreshDone && msg?.kind === "ok" ? PANEL_REFRESHED_MSG : null;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || working || !!uncertain}
        aria-busy={working}
        className={`${base} ${styles}`}
      >
        {label}
      </button>
      {msg && (
        <StatusLine msg={msg}>
          {note && <span className="ml-1 text-neutral-500">· {note}</span>}
          {uncertain && (
            <button
              type="button"
              className="ml-2 underline disabled:no-underline disabled:opacity-50"
              disabled={uncertain.checking}
              onClick={checkResult}
            >
              {uncertain.checking ? busyLabelFor("check-result") : "Перевірити результат"}
            </button>
          )}
          {!uncertain && msg.kind === "conflict" && (
            <button
              type="button"
              className="ml-2 underline disabled:no-underline disabled:opacity-50"
              disabled={refreshing}
              onClick={refresh}
            >
              {refreshing ? busyLabelFor("refresh") : "Оновити"}
            </button>
          )}
        </StatusLine>
      )}
    </span>
  );
}

/**
 * Two-step "Прибрати старі копії фото": first click is a DRY RUN (server reports
 * count + size + the branch head it was computed against); the button then turns
 * into "Підтвердити …" and the second click deletes exactly that set against
 * that head. A publish landing in between makes the confirm a no-op conflict.
 *
 * The dry-run plan is bound to the exact branch head it was computed against
 * (`plan.headSha`). The client drops a pending plan the moment the branch head
 * (`headSha` prop, from the server render) moves — a single file's token
 * (`publishedVersion`) cannot stand in for the branch head, so it is only a
 * secondary signal for local mode (which has no branch).
 */
export function CleanupFrozenMediaButton({
  publishedVersion,
  headSha,
}: {
  publishedVersion?: string;
  headSha?: string | null;
}) {
  const { busy: refreshing, slow: refreshSlow, done: refreshDone, refresh } = useRefresh();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionMessage | null>(null);
  const [plan, setPlan] = useState<{
    count: number;
    headSha: string;
    paths: string[];
    forHead?: string | null;
    forVersion?: string;
  } | null>(null);
  const inFlight = useRef(false);
  // Locked after a confirm whose result is unknown. `planPaths` is kept so the
  // read-only check can verify exactly that set of files is gone.
  const [uncertain, setUncertain] = useState<{ checking: boolean; planPaths: string[] } | null>(null);

  // A plan is stale if the branch head it was computed against has moved
  // (github mode), or — local mode, no branch — if published.json changed.
  const planStale =
    plan != null &&
    ((headSha != null && plan.forHead != null && plan.forHead !== headSha) ||
      plan.forVersion !== publishedVersion);
  if (planStale) {
    setPlan(null);
    if (msg) setMsg(null);
  }

  const checkResult = async () => {
    if (uncertain?.checking) return;
    const planPaths = uncertain?.planPaths ?? [];
    setUncertain({ checking: true, planPaths });
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-result",
          check: { action: "cleanup-frozen-media", planPaths },
          versions: {},
        }),
      });
      let data: { applied?: boolean | null; message?: string } | null = null;
      try {
        data = (await res.json()) as { applied?: boolean | null; message?: string };
      } catch {
        data = null;
      }
      if (!data || data.applied === undefined) {
        setUncertain({ checking: false, planPaths });
        setMsg({ kind: "uncertain", text: "Перевірити результат не вдалося — спробуйте ще раз." });
        return;
      }
      const applied = data.applied ?? null;
      const text = data.message ?? "";
      setMsg({ kind: applied === true ? "ok" : applied === false ? "conflict" : "uncertain", text });
      if (applied === null) {
        setUncertain({ checking: false, planPaths });
      } else {
        setUncertain(null);
        refresh();
      }
    } catch {
      setUncertain({ checking: false, planPaths });
      setMsg({ kind: "uncertain", text: "Перевірити результат не вдалося — спробуйте ще раз." });
    }
  };

  async function call(confirm: boolean, headSha?: string) {
    if (inFlight.current || busy || refreshing || uncertain) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup-frozen-media", confirm, headSha, versions: {} }),
      });
      type CleanupData = ActionResponse & {
        cleanup?: { count: number; totalBytes: number; headSha: string; paths: string[] };
      };
      let data: CleanupData | null = null;
      try {
        data = (await res.json()) as CleanupData;
      } catch {
        data = null; // sent, but no structured answer — treat as unknown outcome
      }
      if (!data || (!data.ok && data.outcome === "unknown")) {
        // A confirm whose result is unknown MUST lock — the delete commit may
        // have landed. Keep this plan's paths for the read-only check. A dry run
        // writes nothing, but if the server ever says "unknown" we still lock.
        const planPaths = confirm ? (plan?.paths ?? []) : [];
        setPlan(null);
        setUncertain({ checking: false, planPaths });
        setMsg(data ? messageForResponse(data) : { kind: "uncertain", text: NETWORK_UNCERTAIN_MSG });
      } else if (data.ok && data.cleanup && !confirm) {
        setPlan({
          count: data.cleanup.count,
          headSha: data.cleanup.headSha,
          paths: data.cleanup.paths ?? [],
          forHead: headSha ?? null,
          forVersion: publishedVersion,
        });
        setMsg({ kind: "ok", text: data.message });
      } else {
        setPlan(null);
        // Only a real deletion (a confirm) changed anything worth re-rendering;
        // a dry run with nothing to clean must not trigger a refresh.
        const refreshed = data.ok && confirm;
        setMsg(messageForResponse(data, refreshed));
        if (refreshed) refresh();
      }
    } catch {
      const planPaths = confirm ? (plan?.paths ?? []) : [];
      setPlan(null);
      setUncertain({ checking: false, planPaths });
      setMsg({ kind: "uncertain", text: NETWORK_UNCERTAIN_MSG });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const cls =
    "inline-flex min-h-[36px] items-center rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed";
  const working = busy || refreshing || !!uncertain;
  const note = refreshSlow ? REFRESH_SLOW_MSG : refreshDone && msg?.kind === "ok" ? PANEL_REFRESHED_MSG : null;
  const confirmLabel = busy
    ? busyLabelFor("cleanup-confirm")
    : refreshing
      ? busyLabelFor("refresh")
      : null;
  const idleLabel = busy
    ? busyLabelFor("cleanup-dry-run")
    : refreshing
      ? busyLabelFor("refresh")
      : null;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {plan ? (
        <span className="inline-flex gap-2">
          <button
            type="button"
            disabled={working}
            aria-busy={busy || refreshing}
            onClick={() => call(true, plan.headSha)}
            className={`${cls} border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950`}
          >
            {confirmLabel ?? `Підтвердити — прибрати ${plan.count}`}
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => {
              setPlan(null);
              setMsg(null);
            }}
            className={`${cls} border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
          >
            Скасувати
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={working}
          aria-busy={busy || refreshing}
          onClick={() => call(false)}
          className={`${cls} border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
        >
          {idleLabel ?? "Прибрати старі копії фото"}
        </button>
      )}
      {msg && (
        <StatusLine msg={msg}>
          {note && <span className="ml-1 text-neutral-500">· {note}</span>}
          {uncertain && (
            <button
              type="button"
              className="ml-2 underline disabled:no-underline disabled:opacity-50"
              disabled={uncertain.checking}
              onClick={checkResult}
            >
              {uncertain.checking ? busyLabelFor("check-result") : "Перевірити результат"}
            </button>
          )}
        </StatusLine>
      )}
    </span>
  );
}

export function RefreshButton() {
  const { busy: refreshing, slow: refreshSlow, refresh } = useRefresh();
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        aria-busy={refreshing}
        className="inline-flex min-h-[36px] items-center rounded border border-neutral-400 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-neutral-800"
      >
        {refreshing ? busyLabelFor("refresh") : "Оновити стан"}
      </button>
      {refreshSlow && (
        <span className="text-[11px] text-neutral-500" role="status" aria-live="polite">
          {REFRESH_SLOW_MSG}
        </span>
      )}
    </span>
  );
}
