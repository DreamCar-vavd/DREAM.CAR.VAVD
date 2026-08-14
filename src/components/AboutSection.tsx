import type { Dictionary } from "@/content/types";

export function AboutSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="about" className="scroll-mt-20 border-b border-border-gold/60 bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
          {dict.about.heading}
        </h2>
        <div className="mt-6 flex flex-col gap-4 text-left text-muted sm:text-center">
          {dict.about.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
