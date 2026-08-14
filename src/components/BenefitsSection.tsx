import { Check } from "lucide-react";
import type { Dictionary } from "@/content/types";

export function BenefitsSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="benefits" className="scroll-mt-20 border-b border-border-gold/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold text-gold sm:text-4xl">
          {dict.benefits.heading}
        </h2>

        <ul className="mx-auto mt-10 grid max-w-4xl gap-x-8 gap-y-5 sm:grid-cols-2">
          {dict.benefits.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-text">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold text-gold">
                <Check size={14} aria-hidden="true" />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
