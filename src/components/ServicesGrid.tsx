"use client";

import { useRef, useState } from "react";
import type { Dictionary } from "@/content/types";
import { services } from "@/content/services";
import { ServiceCard } from "./ServiceCard";
import { SpecialOrderServiceCard } from "./SpecialOrderServiceCard";
import { ServiceModal, type ServiceModalContent } from "./ServiceModal";

const SPECIAL_ORDER_ID = "special-order";

export function ServicesGrid({ dict }: { dict: Dictionary }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  function open(id: string, trigger: HTMLElement) {
    lastTriggerRef.current = trigger;
    setOpenId(id);
  }

  function close() {
    setOpenId(null);
    const trigger = lastTriggerRef.current;
    if (trigger) {
      requestAnimationFrame(() => trigger.focus());
    }
  }

  let activeContent: ServiceModalContent | null = null;
  if (openId === SPECIAL_ORDER_ID) {
    activeContent = {
      title: dict.specialOrderService.title,
      description: dict.specialOrderService.modalText,
    };
  } else if (openId) {
    const copy = dict.services[openId as keyof typeof dict.services];
    if (copy) {
      activeContent = {
        title: copy.title,
        description: copy.longDescription,
        bullets: copy.bullets,
        modalLead: copy.modalLead,
        modalSections: copy.modalSections,
      };
    }
  }

  return (
    <section id="services" className="scroll-mt-20 border-b border-border-gold/60 bg-background">
      <div className="mx-auto max-w-[1760px] px-6 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
            {dict.servicesSection.heading}
          </h2>
          <p className="mt-3 text-muted">{dict.servicesSection.subheading}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-[1760px] gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {services.map(({ slug, iconSrc }) => {
            const copy = dict.services[slug];
            return (
              <ServiceCard
                key={slug}
                iconSrc={iconSrc}
                title={copy.title}
                description={copy.shortDescription}
                readMoreLabel={dict.common.readMore}
                onOpen={(trigger) => open(slug, trigger)}
              />
            );
          })}
          <SpecialOrderServiceCard dict={dict} onOpen={(trigger) => open(SPECIAL_ORDER_ID, trigger)} />
        </div>
      </div>

      {activeContent && (
        <ServiceModal content={activeContent} closeLabel={dict.common.closeLabel} onClose={close} />
      )}
    </section>
  );
}
