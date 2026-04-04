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

export interface Collection {
  id: string;
  name: string;
  description?: string;
  images: GalleryImage[];
  createdAt: string;
}

export type DesignStage = "concept" | "design" | "realistic";

export interface GeneratedDesign {
  id: string;
  url: string;
  prompt: string;
  stage: DesignStage;
  selected?: boolean;
}
