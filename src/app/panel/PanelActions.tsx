"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  busyLabelFor,
  messageForResponse,
  NETWORK_UNCERTAIN_MSG,
  type ActionMessage,
  type ActionResponse,
} from "./actionMessages";

/**
 * `router.refresh()` re-fetches the server component but resolves synchronously
 * and (in this Next version) does not keep a `useTransition` pending for the
 * network round-trip — so on its own it gives the owner no "refreshing" cue
 * while `/panel` re-renders (a few seconds against GitHub). This holds a visible
 * `refreshing` flag for a bounded window after the call; the real end-state is
 * the freshly rendered panel that replaces it.
 */
function useSoftRefresh(holdMs = 2500): { refreshing: boolean; refresh: () => void } {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), holdMs);
  }, [router, holdMs]);
  return { refreshing, refresh };
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
      : msg.kind === "conflict"
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-600";
  return (
    <span
      className={`text-xs ${tone}`}
      role={msg.kind === "err" ? "alert" : "status"}
      aria-live={msg.kind === "err" ? "assertive" : "polite"}
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
}: {
  payload: ActionPayload;
  versions: PanelVersions;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "solid";
  confirmText?: string;
}) {
  const { refreshing, refresh } = useSoftRefresh();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionMessage | null>(null);
  // Synchronous guard: `busy`/`refreshing` only disable on the next render, so
  // two fast clicks — or a click during the post-action refresh — could fire a
  // second request against stale versions. This blocks it immediately.
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current || busy || refreshing) return;
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
      const data = (await res.json()) as ActionResponse;
      setMsg(messageForResponse(data, data.ok));
      if (data.ok) refresh();
    } catch {
      // No response — the write may or may not have landed. Reload and check,
      // do NOT retry blindly. Deliberately different wording from a confirmed save.
      setMsg({ kind: "conflict", text: NETWORK_UNCERTAIN_MSG });
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
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || working}
        aria-busy={working}
        className={`${base} ${styles}`}
      >
        {working ? busyLabelFor(busy ? payload.action : "refresh") : children}
      </button>
      {msg && (
        <StatusLine msg={msg}>
          {msg.kind === "conflict" && (
            <button type="button" className="ml-2 underline" onClick={refresh}>
              Оновити
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
 * `publishedVersion` — the panel's published.json token: when it changes (any
 * publish, incl. this session's refresh) a pending dry-run plan is stale, so we
 * drop it and make the owner re-run the check.
 */
export function CleanupFrozenMediaButton({ publishedVersion }: { publishedVersion?: string }) {
  const { refreshing, refresh } = useSoftRefresh();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionMessage | null>(null);
  const [plan, setPlan] = useState<{ count: number; headSha: string } | null>(null);
  const inFlight = useRef(false);

  // A publish (or the post-cleanup refresh) moved the branch — the shown plan is
  // stale, so drop it and make the owner re-run the check; a confirm against it
  // would only conflict. Adjusted during render (the "reset state on prop
  // change" pattern), not in an effect.
  const [seenVersion, setSeenVersion] = useState(publishedVersion);
  if (publishedVersion !== seenVersion) {
    setSeenVersion(publishedVersion);
    if (plan) setPlan(null);
    if (msg) setMsg(null);
  }

  async function call(confirm: boolean, headSha?: string) {
    if (inFlight.current || busy || refreshing) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup-frozen-media", confirm, headSha, versions: {} }),
      });
      const data = (await res.json()) as ActionResponse & {
        cleanup?: { count: number; totalBytes: number; headSha: string };
      };
      if (data.ok && data.cleanup && !confirm) {
        setPlan({ count: data.cleanup.count, headSha: data.cleanup.headSha });
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
      setPlan(null);
      setMsg({ kind: "conflict", text: NETWORK_UNCERTAIN_MSG });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const cls =
    "inline-flex min-h-[36px] items-center rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed";
  const working = busy || refreshing;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {plan ? (
        <span className="inline-flex gap-2">
          <button
            type="button"
            disabled={working}
            aria-busy={working}
            onClick={() => call(true, plan.headSha)}
            className={`${cls} border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950`}
          >
            {working ? busyLabelFor("cleanup-confirm") : `Підтвердити — прибрати ${plan.count}`}
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
          aria-busy={working}
          onClick={() => call(false)}
          className={`${cls} border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
        >
          {working ? busyLabelFor("cleanup-dry-run") : "Прибрати старі копії фото"}
        </button>
      )}
      {msg && <StatusLine msg={msg} />}
    </span>
  );
}

export function RefreshButton() {
  const { refreshing, refresh } = useSoftRefresh();
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      aria-busy={refreshing}
      className="inline-flex min-h-[36px] items-center rounded border border-neutral-400 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-neutral-800"
    >
      {refreshing ? busyLabelFor("refresh") : "Оновити стан"}
    </button>
  );
}
