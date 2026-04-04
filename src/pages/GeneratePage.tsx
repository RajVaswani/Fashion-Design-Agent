import { useState, useEffect } from "react";
import { Sparkles, Loader2, ImageIcon, Download, FolderOpen } from "lucide-react";
import Layout from "@/components/Layout";
import ImageCard from "@/components/ImageCard";
import { collectionsApi } from "@/lib/collectionsApi";
import type { GalleryImage, Collection } from "@/types/gallery";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const GeneratePage = () => {
  const [prompt, setPrompt] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<GalleryImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // Load collections
  useEffect(() => {
    collectionsApi.list().then((data) => {
      setCollections(data);
      setLoadingCollections(false);
    }).catch(() => setLoadingCollections(false));
  }, []);

  // When a collection is selected, load its images as references
  useEffect(() => {
    if (!selectedCollectionId) {
      setReferenceImages([]);
      return;
    }
    const col = collections.find((c) => c.id === selectedCollectionId);
    if (col) {
      setReferenceImages(col.images.map((img) => ({ ...img, selected: true })));
    }
  }, [selectedCollectionId, collections]);

  const toggleSelect = (id: string) => {
    setReferenceImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a design prompt");
      return;
    }

    const selectedRefs = referenceImages.filter((img) => img.selected);
    if (selectedRefs.length === 0) {
      toast.error("Please select at least one reference image");
      return;
    }

    setIsGenerating(true);

    try {
      // Build context from annotations
      const annotationContext = selectedRefs
        .flatMap((img) => img.annotations.map((a) => a.text))
        .filter((t) => t.length > 0)
        .join("; ");

      const fullPrompt = annotationContext
        ? `${prompt.trim()}\n\nReference design notes: ${annotationContext}`
        : prompt.trim();

      const { data, error } = await supabase.functions.invoke("generate-design", {
        body: {
          prompt: fullPrompt,
          referenceImages: selectedRefs.slice(0, 4).map((img) => img.src),
        },
      });

      if (error) throw error;

      if (data?.images && data.images.length > 0) {
        const newImages = data.images.map(
          (img: { image_url: { url: string } }) => ({
            url: img.image_url.url,
            prompt: prompt.trim(),
          })
        );
        setGeneratedImages((prev) => [...newImages, ...prev]);
        toast.success("Design generated!");
      } else {
        toast.error("No image was generated. Try a different prompt.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="container py-10">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Design <span className="text-gradient-gold">Generator</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1 font-body">
                Select a collection and describe your new design
              </p>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground font-body">
                Design Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the clothing design you want to create... e.g. 'A flowing silk evening gown with geometric patterns inspired by Art Deco, in deep emerald green'"
                className="w-full h-32 bg-card border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
              />
            </div>

            {/* Collection selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground font-body">
                Reference Collection
              </label>
              {loadingCollections ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading collections…
                </div>
              ) : collections.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-body">
                    No collections yet. Go to the Gallery to create one.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {collections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() =>
                        setSelectedCollectionId(
                          selectedCollectionId === col.id ? null : col.id
                        )
                      }
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selectedCollectionId === col.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground font-body truncate">
                        {col.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        {col.images.length} image{col.images.length !== 1 ? "s" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected reference images */}
            {referenceImages.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground font-body">
                  Reference Images ({referenceImages.filter((i) => i.selected).length} selected)
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {referenceImages.map((img) => (
                    <ImageCard
                      key={img.id}
                      image={img}
                      selectable
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg gradient-gold text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 glow-gold font-body"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating with Gemini Pro 3...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Designs
                </>
              )}
            </button>
          </div>

          {/* Right: Results */}
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">
              Generated Designs
            </h2>
            {generatedImages.length === 0 ? (
              <div className="border border-border rounded-xl flex flex-col items-center justify-center py-24 bg-card/50">
                <Sparkles className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm font-body">
                  Your generated designs will appear here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((item, i) => (
                  <div
                    key={i}
                    className="group relative rounded-lg overflow-hidden border border-border bg-card animate-fade-in"
                  >
                    <div className="aspect-[3/4]">
                      <img
                        src={item.url}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate font-body max-w-[80%]">
                        {item.prompt}
                      </span>
                      <a
                        href={item.url}
                        download={`design-${i}.png`}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GeneratePage;
