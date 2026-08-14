import type { SVGProps } from "react";

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.03-1.36A10 10 0 1 0 12 2Z"
      />
      <path
        fill="#fff"
        d="M17.24 14.13c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.19.28-.72.9-.88 1.08-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.24-1.4-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.1-.19.05-.35-.02-.5-.07-.14-.62-1.51-.85-2.07-.22-.54-.45-.47-.62-.48h-.53c-.19 0-.5.07-.76.35-.26.28-1 .98-1 2.39 0 1.41 1.03 2.77 1.17 2.96.14.19 2.03 3.1 4.92 4.35.69.3 1.22.48 1.64.61.69.22 1.32.19 1.81.11.55-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33Z"
      />
    </svg>
  );
}

export function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" fill="#26A5E4" />
      <path
        fill="#fff"
        d="m6.4 11.9 10.2-3.93c.47-.18.88.11.73.83l-1.74 8.2c-.13.6-.5.75-1 .47l-2.78-2.05-1.34 1.29c-.15.15-.28.28-.56.28l.2-2.83 5.15-4.65c.22-.2-.05-.31-.35-.11l-6.37 4-2.74-.86c-.6-.19-.6-.6.13-.64Z"
      />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  const gradientId = "instagram-gradient";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0">
          <stop offset="0" stopColor="#FEE411" />
          <stop offset="0.3" stopColor="#F9CE34" />
          <stop offset="0.45" stopColor="#EE2A7B" />
          <stop offset="0.7" stopColor="#D22A9C" />
          <stop offset="1" stopColor="#6228D7" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill={`url(#${gradientId})`} />
      <rect x="6.3" y="6.3" width="11.4" height="11.4" rx="4" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.1" stroke="#fff" strokeWidth="1.7" />
      <circle cx="17.1" cy="6.9" r="1" fill="#fff" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        fill="#fff"
        d="M13.6 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.56V4.46c-.27-.04-1.2-.12-2.28-.12-2.25 0-3.8 1.38-3.8 3.9v2.18H8v2.96h2.55V21h3.05Z"
      />
    </svg>
  );
}

export function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="1.5" y="4.5" width="21" height="15" rx="4" fill="#FF0000" />
      <path d="M10 8.6v6.8l6-3.4-6-3.4Z" fill="#fff" />
    </svg>
  );
}
