import Image from "next/image";
import type { KeyboardEvent, MouseEvent } from "react";

export function ServiceCard({
  iconSrc,
  title,
  description,
  readMoreLabel,
  onOpen,
}: {
  iconSrc: string;
  title: string;
  description: string;
  readMoreLabel: string;
  onOpen: (trigger: HTMLElement) => void;
}) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    onOpen(event.currentTarget);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(event.currentTarget);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group relative cursor-pointer rounded-sm border border-border-gold/50 p-[3px] transition-all duration-[280ms] ease-out hover:-translate-y-1 hover:border-gold motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative flex h-full min-h-[300px] flex-col items-start gap-4 rounded-sm border border-border-gold/30 bg-surface p-6 shadow-[0_0_0_rgba(212,175,55,0)] transition-shadow duration-[280ms] ease-out group-hover:scale-[1.015] group-hover:shadow-[0_10px_28px_rgba(212,175,55,0.16)] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center">
          <Image src={iconSrc} alt={title} width={72} height={72} quality={90} className="h-[72px] w-[72px] object-contain" />
        </span>
        <h3 className="font-heading text-xl font-semibold text-text">{title}</h3>
        <p className="flex-1 text-sm text-muted">{description}</p>
        <span className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-gold transition-colors duration-300 group-hover:text-gold-light">
          {readMoreLabel}
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </div>
  );
}
