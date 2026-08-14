export type ServiceSlug =
  | "car-selection"
  | "car-service"
  | "diagnostics"
  | "srs-airbag"
  | "detailing";

export interface ServiceCopy {
  title: string;
  shortDescription: string;
  longDescription: string;
  bullets: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export type CarListingId = "suzuki-sx4-s-cross" | "dacia-sandero-2022";

export interface CarListingCopy {
  title: string;
  year: string;
  specLine: string;
  mileage: string;
  price: string;
  viewGallery: string;
}

export type GalleryProjectId =
  | "maserati-levante"
  | "volvo-xc60-d5"
  | "showcase-01"
  | "showcase-02"
  | "showcase-03"
  | "showcase-04"
  | "showcase-05"
  | "showcase-06";

export interface GalleryProjectCopy {
  title: string;
  year: string;
  service: string;
  clientRequest: string;
  completedItems: string[];
  result: string;
}

export interface Dictionary {
  meta: {
    siteName: string;
    homeTitle: string;
    homeDescription: string;
  };
  nav: {
    home: string;
    services: string;
    howWeWork: string;
    gallery: string;
    about: string;
    faq: string;
    contacts: string;
    primaryLabel: string;
    mobileLabel: string;
    footerLabel: string;
    openMenu: string;
    closeMenu: string;
  };
  common: {
    consultationCta: string;
    whatsappCta: string;
    readMore: string;
    phoneLabel: string;
    emailLabel: string;
    backToServices: string;
    languageLabel: string;
    closeLabel: string;
  };
  hero: {
    title: string;
    brandTag: string;
    tagline: string;
    subtitle: string;
    thanksLine: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  servicesSection: {
    heading: string;
    subheading: string;
  };
  services: Record<ServiceSlug, ServiceCopy>;
  specialOrderService: {
    title: string;
    description: string;
    modalText: string;
  };
  carsForSale: {
    heading: string;
    ctaButton: string;
    pageHeading: string;
    statusLabel: string;
    closeGallery: string;
    previousPhoto: string;
    nextPhoto: string;
    contactCta: string;
    photoAlt: string;
    videoAlt: string;
    listings: Record<CarListingId, CarListingCopy>;
  };
  process: {
    heading: string;
    subheading: string;
    steps: ProcessStep[];
  };
  benefits: {
    heading: string;
    items: string[];
  };
  gallery: {
    heading: string;
    subheading: string;
    lightboxClose: string;
    lightboxPrev: string;
    lightboxNext: string;
    albumNumberLabel: string;
    albums: {
      maseratiLevante: {
        title: string;
        alts: string[];
      };
      volvoXc60D5: {
        title: string;
        alts: string[];
      };
    };
    modal: {
      clientRequestLabel: string;
      checkedLabel: string;
      resultLabel: string;
    };
    projects: Record<GalleryProjectId, GalleryProjectCopy>;
  };
  about: {
    heading: string;
    paragraphs: string[];
  };
  faq: {
    heading: string;
    items: FaqItem[];
  };
  contact: {
    heading: string;
    subheading: string;
    phone: string;
    email: string;
    form: {
      name: string;
      phone: string;
      email: string;
      service: string;
      vehicle: string;
      message: string;
      consent: string;
      submit: string;
      selectService: string;
      success: string;
      error: string;
      notConfigured: string;
      required: string;
      invalidEmail: string;
      invalidPhone: string;
    };
  };
  footer: {
    description: string;
    rights: string;
    privacy: string;
    cookies: string;
  };
}
