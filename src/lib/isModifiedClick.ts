/**
 * True for a click the browser will NOT turn into a plain, same-tab
 * navigation: a modifier key held (Ctrl/Cmd/Shift/Alt — these make the
 * browser open the link in a new tab/window instead), a middle-click
 * (button 1), or a link whose own `target` isn't "_self".
 *
 * Used by the service-modal and car-listing "contact us" CTAs to decide
 * whether to write a same-tab contact-intent (see serviceContactIntent.ts /
 * vehicleContactIntent.ts) and close the modal/gallery. Writing the intent
 * unconditionally was the actual cause of a stale value surviving in THIS
 * tab's sessionStorage after a Ctrl/Cmd-click opened a background tab
 * instead of navigating here: the click handler ran (and wrote the intent)
 * even though this tab never moved. A TTL only shrinks the window during
 * which that stale value could misfire on a later, unrelated visit — it
 * doesn't stop the value from being written in the first place. This check
 * removes the write at its source: for a modified click, the handler does
 * nothing at all, so nothing is ever left behind on this tab.
 */
export interface ModifiableClickEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  currentTarget: { getAttribute(name: string): string | null };
}

export function isModifiedClick(event: ModifiableClickEvent): boolean {
  const target = event.currentTarget.getAttribute("target");
  return (
    (target !== null && target !== "_self") ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button === 1
  );
}
