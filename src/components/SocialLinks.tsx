import { getSocialLinks } from "@/lib/social";
import {
  WhatsAppIcon,
  TelegramIcon,
  InstagramIcon,
  FacebookIcon,
  YouTubeIcon,
} from "./icons/SocialIcons";
import type { ComponentType, SVGProps } from "react";
import type { SocialLink } from "@/lib/social";

const icons: Record<SocialLink["name"], ComponentType<SVGProps<SVGSVGElement>>> = {
  WhatsApp: WhatsAppIcon,
  Telegram: TelegramIcon,
  Instagram: InstagramIcon,
  Facebook: FacebookIcon,
  YouTube: YouTubeIcon,
};

export function SocialLinks({ className }: { className?: string }) {
  const links = getSocialLinks();

  if (links.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      {links.map((link) => {
        const Icon = icons[link.name];
        const iconSizeClass = link.name === "Instagram" ? "h-[26px] w-[26px]" : "h-5 w-5";
        return (
          <li key={link.name}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.name === "Instagram" ? "Instagram DREAM.CAR.VAVD" : link.name}
              title={link.name}
              className="social-icon-link flex h-11 w-11 items-center justify-center rounded-full border-2 border-gold transition-colors duration-300 hover:bg-gold/10"
            >
              <Icon className={iconSizeClass} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
