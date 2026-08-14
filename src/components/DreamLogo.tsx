import Image from "next/image";

export function DreamLogo({
  alt,
  wrapperClassName,
  priority,
}: {
  alt: string;
  wrapperClassName: string;
  priority?: boolean;
}) {
  return (
    <span className={`dream-logo relative isolate ${wrapperClassName}`}>
      <Image
        src="/images/dream-car-logo.png"
        alt={alt}
        width={1413}
        height={800}
        priority={priority}
        className="block h-full w-full"
      />
      <span className="dream-logo__shimmer" aria-hidden="true" />
    </span>
  );
}
