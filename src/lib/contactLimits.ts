/**
 * Shared with the client: `ContactForm.tsx` uses these for input
 * `maxLength`, `src/lib/contact.ts` (server-only) uses them for
 * authoritative validation. Kept in a separate, non-`server-only` module
 * so the client form can import them without pulling in server code.
 */
export const CONTACT_MAX_LENGTHS = {
  name: 100,
  phone: 30,
  email: 254,
  service: 100,
  vehicle: 200,
  message: 5000,
} as const;
