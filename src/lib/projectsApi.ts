import { supabase } from "@/integrations/supabase/client";
import type { DesignStage, GeneratedDesign } from "@/types/gallery";

export interface Project {
  id: string;
  name: string;
  description?: string;
  masterPrompt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  collectionIds: string[];
  designs: GeneratedDesign[];
}

export const projectsApi = {
  async list(): Promise<Project[]> {
    const [projRes, pcRes, desRes] = await Promise.all([
      supabase.from("projects").select("*").order("updated_at", { ascending: false }),
      supabase.from("project_collections").select("*"),
      supabase.from("project_designs").select("*").order("created_at", { ascending: false }),
    ]);
    if (projRes.error) throw projRes.error;

    const colsByProject = new Map<string, string[]>();
    for (const pc of pcRes.data || []) {
      const list = colsByProject.get(pc.project_id) || [];
      list.push(pc.collection_id);
      colsByProject.set(pc.project_id, list);
    }

    const desByProject = new Map<string, GeneratedDesign[]>();
    for (const d of desRes.data || []) {
      const list = desByProject.get(d.project_id) || [];
      list.push({
        id: d.id,
        url: d.image_url,
        prompt: d.prompt,
        stage: d.stage as DesignStage,
        selected: d.selected,
        notes: (d as any).notes || "",
      });
      desByProject.set(d.project_id, list);
    }

    return (projRes.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      collectionIds: colsByProject.get(p.id) || [],
      designs: desByProject.get(p.id) || [],
    }));
  },

  async get(id: string): Promise<Project> {
    const [projRes, pcRes, desRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("project_collections").select("*").eq("project_id", id),
      supabase.from("project_designs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    ]);
    if (projRes.error) throw projRes.error;
    const p = projRes.data;

    return {
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      collectionIds: (pcRes.data || []).map((pc) => pc.collection_id),
      designs: (desRes.data || []).map((d) => ({
        id: d.id,
        url: d.image_url,
        prompt: d.prompt,
        stage: d.stage as DesignStage,
        selected: d.selected,
        notes: (d as any).notes || "",
      })),
    };
  },

  async create(name: string, description?: string): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, description: description || null, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      collectionIds: [],
      designs: [],
    };
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async linkCollection(projectId: string, collectionId: string): Promise<void> {
    const { error } = await supabase
      .from("project_collections")
      .insert({ project_id: projectId, collection_id: collectionId });
    if (error && !error.message.includes("duplicate")) throw error;
  },

  async unlinkCollection(projectId: string, collectionId: string): Promise<void> {
    const { error } = await supabase
      .from("project_collections")
      .delete()
      .eq("project_id", projectId)
      .eq("collection_id", collectionId);
    if (error) throw error;
  },

  async saveDesign(projectId: string, design: { prompt: string; imageUrl: string; stage: DesignStage }): Promise<GeneratedDesign> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("project_designs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        prompt: design.prompt,
        image_url: design.imageUrl,
        stage: design.stage,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      url: data.image_url,
      prompt: data.prompt,
      stage: data.stage as DesignStage,
      selected: data.selected,
    };
  },

  async toggleDesignSelected(designId: string, selected: boolean): Promise<void> {
    const { error } = await supabase
      .from("project_designs")
      .update({ selected })
      .eq("id", designId);
    if (error) throw error;
  },

  async updateDesignNotes(designId: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from("project_designs")
      .update({ notes } as any)
      .eq("id", designId);
    if (error) throw error;
  },
};
