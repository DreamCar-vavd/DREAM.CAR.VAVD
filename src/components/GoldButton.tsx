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

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold tracking-wide transition-transform duration-300 ease-out hover:scale-[1.02] focus-visible:outline-offset-4 motion-reduce:transition-none motion-reduce:hover:scale-100 disabled:pointer-events-none disabled:opacity-60 disabled:hover:scale-100";

const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-sm gap-2",
  lg: "px-7 py-3.5 text-base gap-2.5",
};

const variants: Record<Variant, string> = {
  solid: "bg-gold text-[#0a0a0a] hover:bg-gold-light",
  outline: "border border-gold text-gold hover:bg-gold/10",
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
