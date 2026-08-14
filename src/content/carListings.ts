import type { CarListingId } from "./types";

export interface CarListingPhoto {
  src: string;
  width: number;
  height: number;
}

export interface CarListingVideo {
  src: string;
  posterSrc: string;
}

export interface CarListing {
  id: CarListingId;
  photos: CarListingPhoto[];
  videos?: CarListingVideo[];
}

export const carListings: CarListing[] = [
  {
    id: "suzuki-sx4-s-cross",
    photos: [
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-front.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-left.jpg", width: 5120, height: 3840 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-right.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-rear.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-boot.jpg", width: 5120, height: 3840 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-interior-front.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-interior-rear.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-sunroof-interior.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-sunroof-wide.jpg", width: 3840, height: 5120 },
      { src: "/images/cars-for-sale/suzuki-sx4-s-cross/suzuki-dashboard.jpg", width: 5120, height: 3840 },
    ],
  },
  {
    id: "dacia-sandero-2022",
    photos: [
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-front.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-left.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-right.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-rear.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-interior-front.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-interior-front-right.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-interior-rear.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-interior-rear-right.jpg", width: 5712, height: 4284 },
      { src: "/images/cars-for-sale/dacia-sandero-2022/dacia-dashboard.jpg", width: 5712, height: 4284 },
    ],
    videos: [
      {
        src: "/images/cars-for-sale/dacia-sandero-2022/dacia-walkaround.mp4",
        posterSrc: "/images/cars-for-sale/dacia-sandero-2022/dacia-front.jpg",
      },
    ],
  },
];
