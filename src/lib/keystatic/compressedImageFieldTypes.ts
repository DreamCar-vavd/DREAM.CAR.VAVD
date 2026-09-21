/**
 * Shared types for the compressedImage() field wrapper, split into their
 * own file (no "use client", no runtime code -- types are erased at
 * compile time) so both the boundary-agnostic factory
 * (compressedImageField.tsx) and the "use client" picker component
 * (CompressedImageInput.tsx) can import them without creating a client/
 * server import cycle between those two files.
 */
import type { fields } from "@keystatic/core";

export type ImageFieldOptions = Parameters<typeof fields.image>[0];
export type ImageField = ReturnType<typeof fields.image>;
export type ImageInputProps = Parameters<ImageField["Input"]>[0];

export interface CompressedImageInputProps extends ImageInputProps {
  BaseInput: ImageField["Input"];
}
