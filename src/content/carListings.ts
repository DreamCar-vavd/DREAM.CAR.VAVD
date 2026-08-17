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
  {
    id: "dacia-sandero-comfort-2019",
    photos: [
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/01-front.jpeg", width: 2048, height: 1536 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/02-front-right.jpeg", width: 2048, height: 1536 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/03-right-side.jpeg", width: 2048, height: 1536 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/04-rear-right.jpeg", width: 2048, height: 1536 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/05-rear.jpeg", width: 2048, height: 1536 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/06-rear-left.jpeg", width: 1536, height: 2048 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/07-left-side.jpeg", width: 1536, height: 2048 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/08-driver-door.jpeg", width: 1200, height: 1600 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/09-rear-door.jpeg", width: 1200, height: 1600 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/10-front-interior.jpeg", width: 1600, height: 1200 },
      { src: "/images/cars-for-sale/dacia-sandero-comfort-2019/11-service-book.jpeg", width: 1200, height: 1600 },
    ],
    videos: [
      {
        src: "/images/cars-for-sale/dacia-sandero-comfort-2019/12-walkaround.mp4",
        posterSrc: "/images/cars-for-sale/dacia-sandero-comfort-2019/01-front.jpeg",
      },
    ],
  },
];
