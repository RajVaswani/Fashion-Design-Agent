import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronLeft } from "lucide-react";
import AiImproveButton from "@/components/AiImproveButton";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import StageIndicator from "@/components/generate/StageIndicator";
import CollectionSelector from "@/components/generate/CollectionSelector";
import DesignResults from "@/components/generate/DesignResults";
import ImageCard from "@/components/ImageCard";
import { collectionsApi } from "@/lib/collectionsApi";
import { projectsApi, type Project } from "@/lib/projectsApi";
import type { GalleryImage, Collection, DesignStage, GeneratedDesign } from "@/types/gallery";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const stagePromptHints: Record<DesignStage, string> = {
  concept: "Describe the clothing design concept… e.g. 'A flowing silk evening gown with geometric Art Deco patterns in emerald green'",
  design: "Refine the selected concepts… e.g. 'Add intricate beading along the neckline, make the silhouette more fitted'",
  realistic: "Describe the final look… e.g. 'Show on a model, studio lighting, white background, e-commerce product photo'",
};

const GeneratePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [stage, setStage] = useState<DesignStage>("concept");
  const [prompt, setPrompt] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<GalleryImage[]>([]);
  const [designs, setDesigns] = useState<GeneratedDesign[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingProject, setLoadingProject] = useState(!!projectId);

  // Load project if we have an ID
  useEffect(() => {
    if (!projectId) { setLoadingProject(false); return; }
    projectsApi.get(projectId).then((p) => {
      setProject(p);
      setDesigns(p.designs);
      setSelectedCollectionIds(p.collectionIds);
      setStage(p.status as DesignStage || "concept");
      setLoadingProject(false);
    }).catch(() => {
      toast.error("Project not found");
      navigate("/projects");
    });
  }, [projectId, navigate]);

  // Load collections
  useEffect(() => {
    collectionsApi.list().then((data) => {
      setCollections(data);
      setLoadingCollections(false);
    }).catch(() => setLoadingCollections(false));
  }, []);

  // Build reference images from selected collections
  useEffect(() => {
    const imgs: GalleryImage[] = [];
    for (const id of selectedCollectionIds) {
      const col = collections.find((c) => c.id === id);
      if (col) imgs.push(...col.images.map((img) => ({ ...img, selected: true })));
    }
    setReferenceImages(imgs);
  }, [selectedCollectionIds, collections]);

  const toggleCollection = async (id: string) => {
    const isRemoving = selectedCollectionIds.includes(id);
    setSelectedCollectionIds((prev) =>
      isRemoving ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // Persist link to project
    if (projectId) {
      try {
        if (isRemoving) {
          await projectsApi.unlinkCollection(projectId, id);
        } else {
          await projectsApi.linkCollection(projectId, id);
        }
      } catch (err) {
        console.error("Failed to update project collections", err);
      }
    }
  };

  const toggleRefImage = (id: string) => {
    setReferenceImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, selected: !img.selected } : img))
    );
  };

  const toggleDesignSelect = async (id: string) => {
    const design = designs.find((d) => d.id === id);
    if (!design) return;
    const newSelected = !design.selected;
    setDesigns((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: newSelected } : d))
    );
    try {
      await projectsApi.toggleDesignSelected(id, newSelected);
    } catch (err) {
      console.error("Failed to toggle selection", err);
    }
  };

  const handlePromoteSelected = async () => {
    const nextStage: DesignStage = stage === "concept" ? "design" : "realistic";
    setStage(nextStage);
    if (projectId) {
      try {
        await projectsApi.updateStatus(projectId, nextStage);
      } catch (err) {
        console.error(err);
      }
    }
    toast.success(`Moved to ${nextStage} stage — refine with a new prompt`);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Please enter a design prompt"); return; }

    const selectedRefs = referenceImages.filter((img) => img.selected);
    const previousStage: DesignStage | null = stage === "design" ? "concept" : stage === "realistic" ? "design" : null;
    const selectedPrevDesigns = previousStage ? designs.filter((d) => d.stage === previousStage && d.selected) : [];

    if (stage === "concept" && selectedRefs.length === 0) { toast.error("Select at least one reference collection"); return; }
    if (stage !== "concept" && selectedPrevDesigns.length === 0 && selectedRefs.length === 0) { toast.error("Select designs from the previous stage"); return; }

    setIsGenerating(true);
    try {
      const annotationContext = selectedRefs
        .flatMap((img) => img.annotations.map((a) => a.text))
        .filter((t) => t.length > 0)
        .join("; ");

      const imageUrls = [
        ...selectedRefs.slice(0, 4).map((img) => img.src),
        ...selectedPrevDesigns.slice(0, 4).map((d) => d.url),
      ].slice(0, 8);

      const { data, error } = await supabase.functions.invoke("generate-design", {
        body: { prompt: prompt.trim(), referenceImages: imageUrls, annotationContext, stage },
      });
      if (error) throw error;

      if (data?.images && data.images.length > 0) {
        const newDesigns: GeneratedDesign[] = [];
        for (const img of data.images) {
          if (projectId) {
            const saved = await projectsApi.saveDesign(projectId, {
              prompt: prompt.trim(),
              imageUrl: img.image_url.url,
              stage,
            });
            newDesigns.push(saved);
          } else {
            newDesigns.push({
              id: crypto.randomUUID(),
              url: img.image_url.url,
              prompt: prompt.trim(),
              stage,
              selected: false,
            });
          }
        }
        setDesigns((prev) => [...newDesigns, ...prev]);

        if (projectId) {
          await projectsApi.updateStatus(projectId, stage);
        }

        toast.success(
          stage === "concept" ? "Concepts generated! Select favorites to refine."
            : stage === "design" ? "Designs refined! Select the best for renders."
            : "Realistic renders ready!"
        );
      } else {
        toast.error("No image generated. Try a different prompt.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const stageButtonLabel: Record<DesignStage, string> = {
    concept: "Generate Concepts",
    design: "Refine Designs",
    realistic: "Render Realistic",
  };

  if (loadingProject) {
    return (
      <Layout>
        <div className="container py-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {/* Project header */}
        {project && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate("/projects")}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">{project.name}</h2>
              {project.description && (
                <p className="text-xs text-muted-foreground font-body">{project.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Stage indicator */}
        <div className="mb-6">
          <StageIndicator current={stage} onChange={setStage} />
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
          {/* Left: Controls */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {stage === "concept" && (<>Design <span className="text-gradient-gold">Concepts</span></>)}
                {stage === "design" && (<>Refine <span className="text-gradient-gold">Design</span></>)}
                {stage === "realistic" && (<>Realistic <span className="text-gradient-gold">Renders</span></>)}
              </h1>
              <p className="text-muted-foreground text-xs mt-1 font-body">
                {stage === "concept" && "Select collections and describe your vision"}
                {stage === "design" && "Pick your favorite concepts and add detail"}
                {stage === "realistic" && "Select refined designs for photorealistic output"}
              </p>
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground font-body">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={stagePromptHints[stage]}
                className="w-full h-28 bg-card border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
              />
            </div>

            {/* Collections */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground font-body">
                Reference Collections
                {selectedCollectionIds.length > 0 && <span className="text-primary ml-1">({selectedCollectionIds.length})</span>}
              </label>
              <CollectionSelector
                collections={collections}
                selectedIds={selectedCollectionIds}
                onToggle={toggleCollection}
                loading={loadingCollections}
                onCollectionCreated={(col) => {
                  setCollections((prev) => [col, ...prev]);
                  toggleCollection(col.id);
                }}
              />
            </div>

            {/* Reference images */}
            {referenceImages.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground font-body">
                  Reference Images ({referenceImages.filter((i) => i.selected).length}/{referenceImages.length})
                </label>
                <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto">
                  {referenceImages.map((img) => (
                    <ImageCard key={img.id} image={img} selectable onToggleSelect={toggleRefImage} />
                  ))}
                </div>
              </div>
            )}

            {/* Previous stage selections */}
            {stage !== "concept" && (() => {
              const prevStage = stage === "design" ? "concept" : "design";
              const prevSelected = designs.filter((d) => d.stage === prevStage && d.selected);
              return (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground font-body">
                    Selected from {prevStage === "concept" ? "Concepts" : "Designs"} ({prevSelected.length})
                  </label>
                  {prevSelected.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                      {prevSelected.map((d) => (
                        <div key={d.id} className="rounded-md overflow-hidden border border-primary/30 aspect-[3/4]">
                          <img src={d.url} alt={d.prompt} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-body">
                      Go back to {prevStage === "concept" ? "Concepts" : "Designs"} and select items to refine
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg gradient-gold text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 glow-gold font-body"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {stageButtonLabel[stage]}</>
              )}
            </button>
          </div>

          {/* Right: Results */}
          <div>
            <DesignResults
              designs={designs}
              stage={stage}
              selectable={stage !== "realistic"}
              onToggleSelect={toggleDesignSelect}
              onPromoteSelected={handlePromoteSelected}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GeneratePage;
