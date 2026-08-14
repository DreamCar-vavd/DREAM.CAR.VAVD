import type { ComponentType, SVGProps } from "react";
import {
  CarSelectionIcon,
  CarRepairIcon,
  ComputerDiagnosticsIcon,
  SrsAirbagIcon,
  DetailingIcon,
} from "@/components/icons/ServiceIcons";
import type { ServiceSlug } from "./types";

export interface ServiceMeta {
  slug: ServiceSlug;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconSrc: string;
}

export const services: ServiceMeta[] = [
  {
    slug: "car-selection",
    icon: CarSelectionIcon,
    iconSrc: "/images/services/premium-3d/01-car-selection-premium-3d.png",
  },
  {
    slug: "car-service",
    icon: CarRepairIcon,
    iconSrc: "/images/services/premium-3d/02-car-service-premium-3d.png",
  },
  {
    slug: "diagnostics",
    icon: ComputerDiagnosticsIcon,
    iconSrc: "/images/services/premium-3d/03-computer-diagnostics-premium-3d.png",
  },
  {
    slug: "srs-airbag",
    icon: SrsAirbagIcon,
    iconSrc: "/images/services/premium-3d/04-srs-airbag-premium-3d.png",
  },
  {
    slug: "detailing",
    icon: DetailingIcon,
    iconSrc: "/images/services/premium-3d/05-detailing-polishing-premium-3d.png",
  },
];

export const serviceSlugs: ServiceSlug[] = services.map((s) => s.slug);
