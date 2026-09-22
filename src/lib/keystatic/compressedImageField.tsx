/**
 * A drop-in replacement for `fields.image()` that optimizes every picked
 * photo to WebP in the browser (see compressImageInBrowser.ts) before it
 * ever reaches Keystatic's own form state — so the value the rest of the
 * app sees (serialize/parse/validation/directory, the publish gate,
 * content-guard) is always already-optimized WebP, with zero changes
 * anywhere else.
 *
 * Built by SPREADING the real `fields.image()` field and replacing only
 * `Input`: every other property (serialize, parse, validate, filename,
 * directory, reader, label) is Keystatic's own, untouched.
 *
 * Deliberately NOT a "use client" module: `keystatic.config.ts` is
 * evaluated by server code too (`/api/keystatic/[...params]`), and Next.js
 * refuses to call an exported FUNCTION from a "use client" file outside of
 * JSX -- calling `compressedImage({...})` as a plain factory at schema
 * -build time would break exactly that way. The actual hook-using picker
 * UI lives in the separate "use client" file CompressedImageInput.tsx; this
 * factory only ever references it as a JSX element (`<CompressedImageInput
 * .../>`), which is allowed to cross the boundary — the same pattern
 * Keystatic's own `fields.image()` uses internally for `ImageFieldInput`.
 */
import { fields } from "@keystatic/core";
import { CompressedImageInput } from "./CompressedImageInput";
import type { ImageField, ImageFieldOptions, ImageInputProps } from "./compressedImageFieldTypes";

/**
 * Same options as `fields.image()` (label, directory, validation,
 * description, publicPath, transformFilename) -- passed straight through,
 * unchanged. Only the picker's `Input` differs: every pick is optimized to
 * WebP first.
 */
export function compressedImage(options: ImageFieldOptions): ImageField {
  const base = fields.image(options);
  const BaseInput = base.Input;
  return {
    ...base,
    Input(props: ImageInputProps) {
      return <CompressedImageInput {...props} BaseInput={BaseInput} />;
    },
  };
}
