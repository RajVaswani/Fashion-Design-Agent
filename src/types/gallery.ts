export interface Annotation {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
}

export interface GalleryImage {
  id: string;
  src: string;
  name: string;
  annotations: Annotation[];
  selected?: boolean;
}
