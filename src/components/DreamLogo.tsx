import Image from "next/image";

export function DreamLogo({
  alt,
  wrapperClassName,
  sizes,
}: {
  alt: string;
  wrapperClassName: string;
  sizes?: string;
}) {
  return (
    <span className={`dream-logo relative isolate ${wrapperClassName}`}>
      <Image
        src="/images/dream-car-logo.png"
        alt={alt}
        width={1413}
        height={800}
        sizes={sizes}
        className="block h-full w-full"
      />
      <span className="dream-logo__shimmer" aria-hidden="true" />
    </span>
  );
}
