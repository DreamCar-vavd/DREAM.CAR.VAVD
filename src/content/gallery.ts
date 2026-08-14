export interface GalleryImage {
  src: string;
  width: number;
  height: number;
}

export const galleryImages: GalleryImage[] = Array.from({ length: 6 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/images/gallery/${n}.jpg`, width: 800, height: i % 2 === 0 ? 1000 : 800 };
});

export interface GalleryAlbumPhoto {
  src: string;
  width: number;
  height: number;
}

export interface GalleryAlbum {
  id: string;
  number: number;
  titleKey: "maseratiLevante" | "volvoXc60D5";
  cover: GalleryAlbumPhoto;
  photos: GalleryAlbumPhoto[];
}

const maseratiLevantePhotos: GalleryAlbumPhoto[] = [
  { src: "/images/gallery/maserati-levante/maserati-levante-front.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-side-left.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-side-front-right.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-rear.jpg", width: 4284, height: 5712 },
  { src: "/images/gallery/maserati-levante/maserati-levante-front-interior-left.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-front-interior-right.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-rear-interior-left.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/maserati-levante/maserati-levante-dashboard.jpg", width: 5712, height: 4284 },
];

const volvoXc60D5Photos: GalleryAlbumPhoto[] = [
  { src: "/images/gallery/volvo-xc60-d5/volvo-xc60-side-right.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/volvo-xc60-d5/volvo-xc60-front.jpg", width: 3296, height: 4575 },
  { src: "/images/gallery/volvo-xc60-d5/volvo-xc60-rear.jpg", width: 4284, height: 5082 },
  { src: "/images/gallery/volvo-xc60-d5/volvo-xc60-interior-front.jpg", width: 5712, height: 4284 },
  { src: "/images/gallery/volvo-xc60-d5/volvo-xc60-interior-rear.jpg", width: 5712, height: 4284 },
];

export const galleryAlbums: GalleryAlbum[] = [
  {
    id: "maserati-levante",
    number: 1,
    titleKey: "maseratiLevante",
    cover: maseratiLevantePhotos[0],
    photos: maseratiLevantePhotos,
  },
  {
    id: "volvo-xc60-d5",
    number: 2,
    titleKey: "volvoXc60D5",
    cover: volvoXc60D5Photos[0],
    photos: volvoXc60D5Photos,
  },
];
