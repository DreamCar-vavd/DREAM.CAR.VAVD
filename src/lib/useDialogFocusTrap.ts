"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, a[href], video, input, textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Shared keyboard/scroll behavior for a modal-style overlay: locks
 * background scroll, closes on `Escape`, and (unless `trapFocus` is set
 * to `false`) traps `Tab`/`Shift+Tab` inside `containerRef` while `isOpen`
 * is true.
 *
 * Set `trapFocus: false` for non-modal disclosure widgets (e.g. a mobile
 * nav drawer whose trigger button lives outside the drawer's DOM
 * subtree) where trapping Tab would contradict `role`/`aria-modal`
 * semantics that the caller isn't using. Escape-to-close and scroll-lock
 * still apply; Tab is left to move focus normally.
 *
 * Both `Escape` and `Tab` are handled in the capture phase so they still
 * work when focus is inside a native control with its own shadow DOM
 * (e.g. `<video controls>`), which can otherwise keep a bubble-phase
 * listener from ever seeing the key.
 *
 * The focusable-element list is recomputed on every `Tab` press rather
 * than cached, so it stays correct even when the dialog's content
 * changes while open (e.g. fields added/removed in an editing form).
 *
 * This hook only manages scroll-lock/Escape/Tab-trap. Initial focus and
 * focus-return-to-trigger stay the caller's responsibility, since those
 * depend on what should receive focus first and what triggered the
 * dialog — both specific to each call site.
 */
export function useDialogFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  options: { trapFocus?: boolean } = {},
) {
  const { trapFocus = true } = options;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const handleTabCapture = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const isInside = container.contains(active);

      if (event.shiftKey) {
        if (!isInside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!isInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleEscapeCapture, true);
    if (trapFocus) {
      window.addEventListener("keydown", handleTabCapture, true);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscapeCapture, true);
      if (trapFocus) {
        window.removeEventListener("keydown", handleTabCapture, true);
      }
    };
  }, [isOpen, onClose, containerRef, trapFocus]);
}
