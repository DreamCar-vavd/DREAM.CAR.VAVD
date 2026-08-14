import { galleryImages, galleryAlbums } from "./gallery";
import type { GalleryProjectId } from "./types";

export interface GalleryProjectMedia {
  src: string;
  width: number;
  height: number;
}

export interface GalleryProjectEntry {
  id: GalleryProjectId;
  images: GalleryProjectMedia[];
}

export const galleryProjects: GalleryProjectEntry[] = [
  ...galleryAlbums.map((album) => ({
    id: album.id as GalleryProjectId,
    images: album.photos,
  })),
  ...galleryImages.map((image, index) => ({
    id: `showcase-${String(index + 1).padStart(2, "0")}` as GalleryProjectId,
    images: [image],
  })),
];
