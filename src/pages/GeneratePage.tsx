import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronLeft } from "lucide-react";
import AiImproveButton from "@/components/AiImproveButton";
import VoiceToTextButton from "@/components/VoiceToTextButton";
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
import { Slider } from "@/components/ui/slider";

const OUTPUT_STYLES = [
  { value: "sketch", label: "Sketch", desc: "Hand-drawn fashion illustration" },
  { value: "flat-2d", label: "2D Flat", desc: "Technical flat / spec drawing" },
  { value: "3d-model", label: "3D Model", desc: "3D rendered garment on mannequin" },
  { value: "realistic", label: "Realistic", desc: "Photorealistic on a model" },
] as const;
type OutputStyle = typeof OUTPUT_STYLES[number]["value"];

const STYLE_TAGS = [
  "Minimalist", "Avant-garde", "Streetwear", "Formal", "Bohemian",
  "Tailored fit", "Oversized", "Structured", "Draped", "Layered",
  "Silk", "Denim", "Wool", "Leather", "Cotton", "Linen",
  "Neutral tones", "Bold colors", "Monochrome", "Pastel", "Earth tones",
  "Embroidered", "Pleated", "Ruffled", "Cut-out", "Asymmetric",
];

const strengthLabels = ["Low", "Medium", "High"];
const strengthValues = ["low", "medium", "high"];

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

  // Style controls
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [strengthIndex, setStrengthIndex] = useState(2);
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("sketch");
  const [masterPrompt, setMasterPrompt] = useState("");

  useEffect(() => {
    if (!projectId) { setLoadingProject(false); return; }
    projectsApi.get(projectId).then((p) => {
      setProject(p);
      setDesigns(p.designs);
      setSelectedCollectionIds(p.collectionIds);
      setStage(p.status as DesignStage || "concept");
      setMasterPrompt(p.masterPrompt || "");
      setLoadingProject(false);
    }).catch(() => {
      toast.error("Project not found");
      navigate("/projects");
    });
  }, [projectId, navigate]);

  useEffect(() => {
    collectionsApi.list().then((data) => {
      setCollections(data);
      setLoadingCollections(false);
    }).catch(() => setLoadingCollections(false));
  }, []);

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
    if (projectId) {
      try {
        if (isRemoving) await projectsApi.unlinkCollection(projectId, id);
        else await projectsApi.linkCollection(projectId, id);
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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

  const handleUpdateNotes = (id: string, notes: string) => {
    setDesigns((prev) =>
      prev.map((d) => (d.id === id ? { ...d, notes } : d))
    );
  };

  const handlePromoteSelected = async () => {
    const nextStage: DesignStage = stage === "concept" ? "design" : "realistic";
    setStage(nextStage);
    if (projectId) {
      try { await projectsApi.updateStatus(projectId, nextStage); } catch (err) { console.error(err); }
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
      // Build structured annotation context
      const annotationParts: string[] = [];
      for (const img of selectedRefs) {
        const imgAnnotations = img.annotations.filter((a) => a.text.length > 0);
        if (imgAnnotations.length > 0) {
          annotationParts.push(
            `Image "${img.name}": ${imgAnnotations.map((a) => a.text).join("; ")}`
          );
        }
      }
      const annotationContext = annotationParts.join("\n");

      // Build design notes from selected previous-stage designs
      const designNotes = selectedPrevDesigns
        .filter((d) => d.notes && d.notes.trim().length > 0)
        .map((d) => `Design note: ${d.notes}`)
        .join("\n");

      const fullAnnotationContext = [annotationContext, designNotes].filter(Boolean).join("\n\n");

      // Prioritize: previous stage designs first (they are the base), then ref images for brand context
      const imageUrls = [
        ...selectedPrevDesigns.slice(0, 4).map((d) => d.url),
        ...selectedRefs.slice(0, 4).map((img) => img.src),
      ].slice(0, 8);

      const { data, error } = await supabase.functions.invoke("generate-design", {
        body: {
          prompt: prompt.trim(),
          referenceImages: imageUrls,
          annotationContext: fullAnnotationContext,
          stage,
          styleTags: selectedTags,
          referenceStrength: strengthValues[strengthIndex],
          outputStyle,
          masterPrompt: masterPrompt.trim() || undefined,
        },
      });
      if (error) throw error;

      if (data?.images && data.images.length > 0) {
        const citation = data.text || "";
        const newDesigns: GeneratedDesign[] = [];
        for (const img of data.images) {
          const imageUrl = img.url || img.image_url?.url;
          if (!imageUrl) continue;
          if (projectId) {
            const saved = await projectsApi.saveDesign(projectId, { prompt: prompt.trim(), imageUrl, stage, citation });
            newDesigns.push(saved);
          } else {
            newDesigns.push({ id: crypto.randomUUID(), url: imageUrl, prompt: prompt.trim(), stage, selected: false, citation });
          }
        }
        setDesigns((prev) => [...newDesigns, ...prev]);
        if (projectId) await projectsApi.updateStatus(projectId, stage);
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
        {project && (
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/projects")} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">{project.name}</h2>
              {project.description && <p className="text-xs text-muted-foreground font-body">{project.description}</p>}
            </div>
          </div>
        )}

        {/* Master Prompt */}
        {project && (
          <div className="mb-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground font-body">Project Theme / Master Prompt</label>
              <AiImproveButton text={masterPrompt} context="design-prompt" onImproved={(t) => { setMasterPrompt(t); if (projectId) projectsApi.updateMasterPrompt(projectId, t); }} />
            </div>
            <textarea
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              onBlur={() => { if (projectId) projectsApi.updateMasterPrompt(projectId, masterPrompt); }}
              placeholder="e.g. 'A luxury resort-wear collection inspired by Mediterranean architecture — earthy tones, flowing fabrics, relaxed elegance'"
              className="w-full h-16 bg-card border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
            />
          </div>
        )}

        <div className="mb-6">
          <StageIndicator current={stage} onChange={setStage} />
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground font-body">Prompt</label>
                <div className="flex items-center gap-1.5">
                  <VoiceToTextButton onTranscript={(t) => setPrompt((prev) => (prev ? prev + " " + t : t))} />
                  <AiImproveButton text={prompt} context="design-prompt" onImproved={setPrompt} />
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={stagePromptHints[stage]}
                className="w-full h-28 bg-card border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
              />
            </div>

            {/* Output Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground font-body">Output Style</label>
              <div className="grid grid-cols-4 gap-1.5">
                {OUTPUT_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setOutputStyle(s.value)}
                    className={`px-2 py-2 rounded-lg text-center text-[11px] font-body transition-all ${
                      outputStyle === s.value
                        ? "bg-primary/15 border border-primary text-primary"
                        : "border border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[9px] opacity-60 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground font-body">
                Style Tags
                {selectedTags.length > 0 && <span className="text-primary ml-1">({selectedTags.length})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {STYLE_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-body transition-all ${
                        active
                          ? "bg-primary/15 border border-primary text-primary"
                          : "border border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reference Strength */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground font-body">Reference Strength</label>
                <span className="text-xs text-primary font-body font-medium">{strengthLabels[strengthIndex]}</span>
              </div>
              <Slider
                value={[strengthIndex]}
                onValueChange={([v]) => setStrengthIndex(v)}
                max={2}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-body">
                <span>Creative</span>
                <span>Balanced</span>
                <span>Faithful</span>
              </div>
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

          <div>
            <DesignResults
              designs={designs}
              stage={stage}
              selectable={stage !== "realistic"}
              onToggleSelect={toggleDesignSelect}
              onPromoteSelected={handlePromoteSelected}
              onUpdateNotes={handleUpdateNotes}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GeneratePage;
