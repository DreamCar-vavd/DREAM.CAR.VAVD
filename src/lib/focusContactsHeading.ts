/**
 * Moves keyboard/screen-reader focus onto the contacts heading
 * (`<h2 id="contacts-heading" tabIndex={-1}>` in `page.tsx`) after a
 * "go to contacts" CTA fires. Every such CTA (service modal, car listing,
 * gallery project) deliberately skips refocusing its own trigger for this
 * path — see each caller's `closeForNavigation` — because that trigger can
 * end up scrolled far off-screen once the page lands on `#contacts`,
 * confirmed with real keyboard events. A plain `hashchange` listener was
 * tried first and doesn't work: Next.js's `<Link>` updates the URL via the
 * History API, which never dispatches a `hashchange` event — so this is
 * called directly from each CTA's click handler instead.
 */
export function focusContactsHeading() {
  document.getElementById("contacts-heading")?.focus();
}
