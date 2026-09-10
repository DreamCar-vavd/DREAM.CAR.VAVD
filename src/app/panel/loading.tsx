/**
 * Shown instantly by Next.js while the server renders `/panel` — that render
 * reads several files from GitHub, so a cold open can take a few seconds. This
 * skeleton (and its "Завантаження…" line) means the owner always sees the panel
 * is working rather than a blank/stalled tab. It also appears during a
 * `router.refresh()` after publish / cleanup.
 */
export default function PanelLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10" aria-busy="true">
      <h1 className="text-xl font-bold">Панель публікації</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
          aria-hidden="true"
        />
        Завантаження стану з GitHub…
      </p>

      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="h-4 w-1/3 rounded bg-neutral-200" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-16 rounded bg-neutral-100" />
              <div className="h-6 w-16 rounded bg-neutral-100" />
              <div className="h-6 w-16 rounded bg-neutral-100" />
            </div>
            <div className="mt-3 h-8 w-40 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
