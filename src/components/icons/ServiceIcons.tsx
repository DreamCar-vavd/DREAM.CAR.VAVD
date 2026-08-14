import type { SVGProps } from "react";

const ringGradientStops = (
  <>
    <stop offset="0%" style={{ stopColor: "var(--gold-dark)" }} />
    <stop offset="35%" style={{ stopColor: "var(--gold-light)" }} />
    <stop offset="65%" style={{ stopColor: "var(--gold)" }} />
    <stop offset="82%" style={{ stopColor: "var(--gold-light)" }} />
    <stop offset="100%" style={{ stopColor: "var(--gold-dark)" }} />
  </>
);

function Medallion({
  id,
  children,
  props,
}: {
  id: string;
  children: React.ReactNode;
  props: SVGProps<SVGSVGElement>;
}) {
  const ringId = `${id}-ring`;
  const symbolId = `${id}-symbol`;
  const bgId = `${id}-bg`;
  const shadowId = `${id}-shadow`;
  const glowId = `${id}-glow`;

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={ringId} x1="4" y1="4" x2="60" y2="60">
          {ringGradientStops}
        </linearGradient>
        <linearGradient id={symbolId} x1="0" y1="0" x2="64" y2="64">
          {ringGradientStops}
        </linearGradient>
        <radialGradient id={bgId} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#221a0d" />
          <stop offset="55%" stopColor="#0e0b06" />
          <stop offset="100%" stopColor="#030201" />
        </radialGradient>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <circle
        cx="32"
        cy="32"
        r="29.5"
        fill="none"
        stroke="var(--gold-light)"
        strokeWidth="3"
        opacity="0.3"
        filter={`url(#${glowId})`}
      />

      <g filter={`url(#${shadowId})`}>
        <circle cx="32" cy="32" r="29.5" fill={`url(#${bgId})`} stroke={`url(#${ringId})`} strokeWidth="2.2" />
      </g>

      <path
        d="M9 20 A25 25 0 0 1 43 7"
        fill="none"
        stroke="var(--gold-light)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M21 57 A25 25 0 0 0 56 25"
        fill="none"
        stroke="#000000"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.35"
      />

      <g fill="none" stroke={`url(#${symbolId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export function CarSelectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-car-selection" props={props}>
      <path d="M17 32 L20 24 Q21.5 21 25 21 H31 Q33.5 21 34.5 23.5 L36.5 28" />
      <path d="M14.5 32 H37 Q38.5 32 38.5 33.5 V36 H14.5 V33.5 Q14.5 32 16 32 Z" fill="var(--surface)" />
      <circle cx="19" cy="36.5" r="2.3" fill="var(--surface)" />
      <circle cx="34" cy="36.5" r="2.3" fill="var(--surface)" />
      <circle cx="40" cy="41" r="6.5" />
      <path d="M44.6 45.6 L49 50" strokeWidth="2.4" />
    </Medallion>
  );
}

export function CarRepairIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-car-repair" props={props}>
      <path
        d="M20 44 L33 31"
        strokeWidth="3.4"
      />
      <path d="M15 40 Q12 37 13.5 32.5 L17 36 L19.5 33.5 L16 30 Q20.5 28.5 23.5 31.5 Q26.5 34.5 25 39 Z" fill="none" />
      <g strokeWidth="1.8">
        <circle cx="39" cy="27" r="6.5" />
        <path d="M39 18.5 V21.3 M39 32.7 V35.5 M47.5 27 H44.7 M33.3 27 H30.5 M45 21 L43 23 M33 31 L35 33 M45 33 L43 31 M33 23 L35 21" />
      </g>
    </Medallion>
  );
}

export function ComputerDiagnosticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-diagnostics" props={props}>
      <path d="M16 18 H12 V22 M48 18 H52 V22 M16 46 H12 V42 M48 46 H52 V42" strokeWidth="2.2" />
      <g strokeWidth="1.8">
        <rect x="23" y="27" width="18" height="12" rx="1.5" />
        <path d="M27 27 V24.5 H37 V27 M30 39 V41.5 M34 39 V41.5" />
        <path d="M19 33 H23 M41 33 H45" />
      </g>
      <path d="M19 33 L23.5 33 L25.5 28 L28 38 L30 31 L31.5 35 L33 33 L45 33" strokeWidth="1.6" />
    </Medallion>
  );
}

export function SrsAirbagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-srs-airbag" props={props}>
      <path d="M32 13 L46 18 V30 Q46 42 32 49 Q18 42 18 30 V18 Z" strokeWidth="1.8" />
      <circle cx="23.5" cy="27" r="3" strokeWidth="1.5" />
      <path d="M20.5 39 Q20.5 32.5 23.5 31.2 Q26.5 30.5 26.5 33.5 V39" strokeWidth="1.5" />
      <path
        d="M28.5 23.5 Q41.5 21 42.5 29.5 Q43.5 38 34 39 Q25.5 39 25.5 32 Q25.5 25 28.5 23.5 Z"
        fill="var(--surface)"
        strokeWidth="1.6"
      />
      <path d="M29.5 27.5 Q33.5 29.5 29.8 34" strokeWidth="1" opacity="0.75" />
      <path d="M34.5 25.5 Q37.8 29.5 34.5 34.8" strokeWidth="1" opacity="0.75" />
    </Medallion>
  );
}

export function DetailingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-detailing" props={props}>
      <path d="M13 36 L15.5 29 Q17 26.5 20 26.5 H31 Q33.5 26.5 34.5 29 L36.5 33" />
      <path d="M10.5 36 H38.5 Q40 36 40 37.5 V39.5 H10.5 V37.5 Q10.5 36 12 36 Z" fill="var(--surface)" />
      <circle cx="16" cy="39.8" r="2" fill="var(--surface)" />
      <circle cx="34" cy="39.8" r="2" fill="var(--surface)" />
      <g strokeWidth="1.5">
        <circle cx="34" cy="17" r="4.6" fill="var(--surface)" />
        <path d="M34 10.5 V12.8 M34 21.2 V23.5 M40.3 17 H38 M30 17 H27.7 M39 12 L37.3 13.7 M30.7 20.3 L29 22 M39 22 L37.3 20.3 M30.7 13.7 L29 12" />
        <path d="M38.5 21.5 L42 25" strokeLinecap="round" />
      </g>
      <g strokeWidth="1.7" strokeLinecap="round">
        <path d="M45 15.5 L46.6 19.3 L50.4 20.9 L46.6 22.5 L45 26.3 L43.4 22.5 L39.6 20.9 L43.4 19.3 Z" />
      </g>
      <path d="M49 32 L50.2 34.8 L53 36 L50.2 37.2 L49 40 L47.8 37.2 L45 36 L47.8 34.8 Z" strokeWidth="1.3" />
      <path d="M40.5 42.5 L41.3 44.3 L43 45 L41.3 45.7 L40.5 47.5 L39.7 45.7 L38 45 L39.7 44.3 Z" strokeWidth="1.2" opacity="0.85" />
    </Medallion>
  );
}

export function OrderVehiclesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Medallion id="svc-order-vehicles" props={props}>
      <g strokeWidth="1.5">
        <path d="M11 30 L12.5 26 Q13.3 24.3 15.3 24.3 H21 Q22.7 24.3 23.3 26 L24.5 29" />
        <path d="M9.5 30 H26 V32.5 H9.5 Z" fill="var(--surface)" />
        <circle cx="13" cy="32.5" r="1.7" fill="var(--surface)" />
        <circle cx="22.5" cy="32.5" r="1.7" fill="var(--surface)" />
      </g>
      <g strokeWidth="1.5">
        <circle cx="15" cy="45.5" r="4" />
        <circle cx="31" cy="45.5" r="4" />
        <path d="M17.5 43.5 L23 38.5 H27 M23 38.5 L25.5 45.5 H31 M23 38.5 L20 34.5 H16" />
      </g>
      <g strokeWidth="1.5">
        <path d="M41 46 V29 H45.5 L52 35.5 V46 Z" />
        <circle cx="44.5" cy="46" r="2.6" />
        <circle cx="50" cy="46" r="2.6" />
        <path d="M41 38 H45.5" />
      </g>
    </Medallion>
  );
}
