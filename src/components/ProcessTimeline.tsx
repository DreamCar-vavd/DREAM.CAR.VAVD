import type { Dictionary } from "@/content/types";

export function ProcessTimeline({ dict }: { dict: Dictionary }) {
  return (
    <section id="how-we-work" className="scroll-mt-20 border-b border-border-gold/60 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
            {dict.process.heading}
          </h2>
          <p className="mt-3 text-muted">{dict.process.subheading}</p>
        </div>

        <ol className="mt-12 flex flex-col gap-8 md:flex-row md:gap-4">
          {dict.process.steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-1 gap-4 md:flex-col md:gap-3">
              <div className="flex flex-col items-center md:w-full">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold font-heading text-lg font-bold text-gold">
                  {index + 1}
                </span>
                <span
                  className={`mt-2 w-px flex-1 bg-border-gold md:mt-0 md:h-px md:w-full md:flex-none md:translate-y-[22px] ${
                    index === dict.process.steps.length - 1 ? "hidden lg:block" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="lg:mt-2.5 md:text-center">
                <h3 className="font-heading text-lg font-semibold text-text">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
