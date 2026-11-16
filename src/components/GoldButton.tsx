import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "solid" | "outline";
type Size = "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

// `premium-frame` (globals.css) draws the approved «Рамка 1 — Подвійна класична»
// and owns the hover / touch-active / reduced-motion states for every gold button.
const base =
  "premium-frame inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-60";

const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-sm gap-2",
  lg: "px-7 py-3.5 text-base gap-2.5",
};

const variants: Record<Variant, string> = {
  solid: "bg-gold text-[#0a0a0a]",
  outline: "premium-frame--outline border border-gold text-gold",
};

type LinkProps = BaseProps & ComponentPropsWithoutRef<typeof Link>;
type ButtonProps = BaseProps & ComponentPropsWithoutRef<"button">;

function classes(variant: Variant, size: Size, className?: string) {
  return [base, sizes[size], variants[variant], className].filter(Boolean).join(" ");
}

export function GoldLink({ variant = "solid", size = "md", children, className, ...props }: LinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function GoldButton({ variant = "solid", size = "md", children, className, ...props }: ButtonProps) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
