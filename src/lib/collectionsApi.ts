import { supabase } from "@/integrations/supabase/client";
import type { Collection, GalleryImage, Annotation } from "@/types/gallery";

export const collectionsApi = {
  async list(): Promise<Collection[]> {
    // Fetch all data in 3 parallel queries instead of N+1
    const [colsRes, imgsRes, annsRes] = await Promise.all([
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      supabase.from("collection_images").select("*").order("created_at", { ascending: true }),
      supabase.from("image_annotations").select("*"),
    ]);

    if (colsRes.error) throw colsRes.error;

    // Index annotations by image_id
    const annsByImage = new Map<string, Annotation[]>();
    for (const a of annsRes.data || []) {
      const list = annsByImage.get(a.image_id) || [];
      list.push({ id: a.id, text: a.text, x: a.x, y: a.y });
      annsByImage.set(a.image_id, list);
    }

    // Index images by collection_id
    const imgsByCollection = new Map<string, GalleryImage[]>();
    for (const img of imgsRes.data || []) {
      const list = imgsByCollection.get(img.collection_id) || [];
      list.push({
        id: img.id,
        src: img.src,
        name: img.name,
        selected: img.selected,
        annotations: annsByImage.get(img.id) || [],
      });
      imgsByCollection.set(img.collection_id, list);
    }

    return (colsRes.data || []).map((col) => ({
      id: col.id,
      name: col.name,
      description: col.description || undefined,
      images: imgsByCollection.get(col.id) || [],
      createdAt: col.created_at,
    }));
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

    const imageIds = (imgs || []).map((i) => i.id);
    const { data: allAnns } = imageIds.length > 0
      ? await supabase.from("image_annotations").select("*").in("image_id", imageIds)
      : { data: [] };

    const annsByImage = new Map<string, Annotation[]>();
    for (const a of allAnns || []) {
      const list = annsByImage.get(a.image_id) || [];
      list.push({ id: a.id, text: a.text, x: a.x, y: a.y });
      annsByImage.set(a.image_id, list);
    }

    return (imgs || []).map((img) => ({
      id: img.id,
      src: img.src,
      name: img.name,
      selected: img.selected,
      annotations: annsByImage.get(img.id) || [],
    }));
  },
};
