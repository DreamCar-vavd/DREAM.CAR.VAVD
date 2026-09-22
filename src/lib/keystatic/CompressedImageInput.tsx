"use client";

/**
 * The actual picker UI for `compressedImage()` fields (see
 * compressedImageField.tsx) — kept in its own "use client" file because it
 * uses hooks, while the factory that BUILDS the field descriptor must stay
 * callable from server code (`keystatic.config.ts` is evaluated by
 * `/api/keystatic/[...params]` too, not only by the browser-rendered admin
 * UI) and therefore cannot itself be a "use client" module: Next.js refuses
 * to call an exported FUNCTION from a "use client" file outside of JSX. A
 * component reference crossing that boundary as a prop/JSX element is fine
 * — only calling it as a plain function is not — so the factory below
 * merely renders `<CompressedImageInput BaseInput={...} .../>`, never
 * calls this module's export directly.
 */
import { useCallback, useRef, useState } from "react";
import { compressImageInBrowser, type KeystaticImageValue } from "./compressImageInBrowser";
import type { CompressedImageInputProps } from "./compressedImageFieldTypes";

type Phase = "idle" | "compressing" | "done" | "error";
type ImageValue = KeystaticImageValue | null;

export function CompressedImageInput(props: CompressedImageInputProps) {
  const { BaseInput, ...inputProps } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedPick, setFailedPick] = useState<KeystaticImageValue | null>(null);
  // Bumped on every new pick AND on Remove. A running compression checks
  // this after its await resolves; if it no longer matches the generation
  // it started with, its result is discarded -- a newer selection (or
  // Remove) always wins over a slow, now-stale optimization still in
  // flight.
  const generationRef = useRef(0);
  const { onChange } = inputProps;

  const runCompression = useCallback(
    async (picked: KeystaticImageValue) => {
      const generation = ++generationRef.current;
      setPhase("compressing");
      setErrorMessage(null);
      try {
        const compressed = await compressImageInBrowser(picked);
        if (generationRef.current !== generation) return; // superseded -- discard
        onChange(compressed);
        setPhase("done");
        setFailedPick(null);
      } catch (err) {
        if (generationRef.current !== generation) return; // superseded -- discard
        setPhase("error");
        setErrorMessage((err as Error).message);
        // Kept so "Спробувати ще раз" can retry without asking the owner
        // to re-open the file picker.
        setFailedPick(picked);
      }
    },
    [onChange],
  );

  const handleChange = useCallback(
    (value: ImageValue) => {
      if (value === null) {
        // Remove must clear the field immediately, even mid-compression --
        // bumping the generation makes any in-flight result a no-op above.
        generationRef.current++;
        setPhase("idle");
        setErrorMessage(null);
        setFailedPick(null);
        onChange(null);
        return;
      }
      void runCompression(value);
    },
    [onChange, runCompression],
  );

  return (
    <div>
      <BaseInput {...inputProps} onChange={handleChange} />
      {phase === "compressing" && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Оптимізація фото…</p>
      )}
      {phase === "done" && (
        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
          Фото оптимізовано у WebP
        </p>
      )}
      {phase === "error" && (
        <div className="mt-1 space-y-1">
          <p className="text-xs text-red-800 dark:text-red-300">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              if (failedPick) void runCompression(failedPick);
            }}
            className="text-xs underline"
          >
            Спробувати ще раз
          </button>
        </div>
      )}
    </div>
  );
}
