"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/content/types";

export function FaqAccordion({ dict }: { dict: Dictionary }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 border-b border-border-gold/60 bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold text-gold sm:text-4xl">
          {dict.faq.heading}
        </h2>

        <div className="mt-10 flex flex-col divide-y divide-border-gold/40 border-y border-border-gold/40">
          {dict.faq.items.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;
            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium text-text"
                  >
                    {item.question}
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gold transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-5 text-sm text-muted"
                >
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
