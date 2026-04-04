import { supabase } from "@/integrations/supabase/client";
import type { Collection, GalleryImage, Annotation } from "@/types/gallery";

export const collectionsApi = {
  async list(): Promise<Collection[]> {
    const { data: cols, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Fetch images + annotations for each collection
    const collections: Collection[] = [];
    for (const col of cols || []) {
      const { data: imgs } = await supabase
        .from("collection_images")
        .select("*")
        .eq("collection_id", col.id)
        .order("created_at", { ascending: true });

      const images: GalleryImage[] = [];
      for (const img of imgs || []) {
        const { data: anns } = await supabase
          .from("image_annotations")
          .select("*")
          .eq("image_id", img.id);

        images.push({
          id: img.id,
          src: img.src,
          name: img.name,
          selected: img.selected,
          annotations: (anns || []).map((a) => ({
            id: a.id,
            text: a.text,
            x: a.x,
            y: a.y,
          })),
        });
      }

      collections.push({
        id: col.id,
        name: col.name,
        description: col.description || undefined,
        images,
        createdAt: col.created_at,
      });
    }

    return collections;
  },

  async create(name: string, description?: string): Promise<Collection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("collections")
      .insert({ name, description: description || null, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      images: [],
      createdAt: data.created_at,
    };
  },

  async deleteCollection(id: string): Promise<void> {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) throw error;
  },

  async addImage(
    collectionId: string,
    src: string,
    name: string,
    annotations: Omit<Annotation, "id">[] = []
  ): Promise<GalleryImage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: img, error } = await supabase
      .from("collection_images")
      .insert({ collection_id: collectionId, user_id: user.id, src, name })
      .select()
      .single();
    if (error) throw error;

    const savedAnnotations: Annotation[] = [];
    if (annotations.length > 0) {
      const { data: anns, error: annErr } = await supabase
        .from("image_annotations")
        .insert(annotations.map((a) => ({ image_id: img.id, text: a.text, x: a.x, y: a.y })))
        .select();
      if (!annErr && anns) {
        savedAnnotations.push(
          ...anns.map((a) => ({ id: a.id, text: a.text, x: a.x, y: a.y }))
        );
      }
    }

    return {
      id: img.id,
      src: img.src,
      name: img.name,
      selected: img.selected,
      annotations: savedAnnotations,
    };
  },

  async deleteImage(imageId: string): Promise<void> {
    const { error } = await supabase.from("collection_images").delete().eq("id", imageId);
    if (error) throw error;
  },

  async addAnnotation(imageId: string, text: string, x: number, y: number): Promise<Annotation> {
    const { data, error } = await supabase
      .from("image_annotations")
      .insert({ image_id: imageId, text, x, y })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, text: data.text, x: data.x, y: data.y };
  },

  async removeAnnotation(annotationId: string): Promise<void> {
    const { error } = await supabase.from("image_annotations").delete().eq("id", annotationId);
    if (error) throw error;
  },

  async getCollectionImages(collectionId: string): Promise<GalleryImage[]> {
    const { data: imgs } = await supabase
      .from("collection_images")
      .select("*")
      .eq("collection_id", collectionId);

    const images: GalleryImage[] = [];
    for (const img of imgs || []) {
      const { data: anns } = await supabase
        .from("image_annotations")
        .select("*")
        .eq("image_id", img.id);

      images.push({
        id: img.id,
        src: img.src,
        name: img.name,
        selected: img.selected,
        annotations: (anns || []).map((a) => ({
          id: a.id,
          text: a.text,
          x: a.x,
          y: a.y,
        })),
      });
    }
    return images;
  },
};
