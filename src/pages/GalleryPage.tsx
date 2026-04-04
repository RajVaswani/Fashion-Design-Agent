import { useState, useRef } from "react";
import {
  Upload,
  ImageIcon,
  Globe,
  Loader2,
  Plus,
  FolderOpen,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import Layout from "@/components/Layout";
import ImageCard from "@/components/ImageCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GalleryImage, Annotation, Collection } from "@/types/gallery";

const GalleryPage = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [showScraper, setShowScraper] = useState(false);
  const [scraping, setScraping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCollection = collections.find((c) => c.id === activeCollectionId) || null;

  // --- helpers ---
  const getImageKey = (src: string, name: string) => {
    try {
      return new URL(src).pathname;
    } catch {
      return name;
    }
  };

  const updateCollectionImages = (
    collectionId: string,
    updater: (images: GalleryImage[]) => GalleryImage[]
  ) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, images: updater(c.images) } : c
      )
    );
  };

  // --- collection CRUD ---
  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    const col: Collection = {
      id: crypto.randomUUID(),
      name: newCollectionName.trim(),
      description: newCollectionDesc.trim() || undefined,
      images: [],
      createdAt: new Date().toISOString(),
    };
    setCollections((prev) => [...prev, col]);
    setActiveCollectionId(col.id);
    setNewCollectionName("");
    setNewCollectionDesc("");
    setShowNewCollection(false);
    toast.success(`Collection "${col.name}" created`);
  };

  const handleDeleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (activeCollectionId === id) setActiveCollectionId(null);
    toast.success("Collection deleted");
  };

  // --- image upload into active collection ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCollectionId) return;
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        updateCollectionImages(activeCollectionId, (imgs) => {
          if (imgs.some((img) => img.name === file.name)) return imgs;
          return [
            ...imgs,
            { id: crypto.randomUUID(), src, name: file.name, annotations: [] },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // --- scrape into active collection ---
  const handleScrapeStore = async () => {
    if (!scrapeUrl.trim() || !activeCollectionId) return;
    setScraping(true);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-store", {
        body: { url: scrapeUrl.trim() },
      });
      if (error) throw error;

      const scraped =
        (data?.images as { src: string; description: string }[]) || [];
      if (scraped.length === 0) {
        toast.info("No images found on this page");
        setScraping(false);
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      updateCollectionImages(activeCollectionId, (imgs) => {
        const existingKeys = new Set(
          imgs.map((img) => getImageKey(img.src, img.name))
        );
        const newImages: GalleryImage[] = [];

        for (const img of scraped) {
          const key = getImageKey(
            img.src,
            img.src.split("/").pop() || "image"
          );
          if (existingKeys.has(key)) {
            skippedCount++;
            continue;
          }
          existingKeys.add(key);

          const fileName =
            img.src.split("/").pop()?.split("?")[0] || "image";
          const annotation: Annotation | null = img.description
            ? { id: crypto.randomUUID(), text: img.description, x: 50, y: 90 }
            : null;

          newImages.push({
            id: crypto.randomUUID(),
            src: img.src,
            name: fileName,
            annotations: annotation ? [annotation] : [],
          });
          addedCount++;
        }

        return [...imgs, ...newImages];
      });

      toast.success(
        `Added ${addedCount} images${skippedCount > 0 ? `, ${skippedCount} duplicates skipped` : ""}`
      );
      setScrapeUrl("");
      setShowScraper(false);
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(err.message || "Failed to scrape store");
    } finally {
      setScraping(false);
    }
  };

  // --- annotation & delete ---
  const handleAddAnnotation = (imageId: string, annotation: Annotation) => {
    if (!activeCollectionId) return;
    updateCollectionImages(activeCollectionId, (imgs) =>
      imgs.map((img) =>
        img.id === imageId
          ? { ...img, annotations: [...img.annotations, annotation] }
          : img
      )
    );
  };

  const handleRemoveAnnotation = (imageId: string, annotationId: string) => {
    if (!activeCollectionId) return;
    updateCollectionImages(activeCollectionId, (imgs) =>
      imgs.map((img) =>
        img.id === imageId
          ? {
              ...img,
              annotations: img.annotations.filter((a) => a.id !== annotationId),
            }
          : img
      )
    );
  };

  const handleDeleteImage = (imageId: string) => {
    if (!activeCollectionId) return;
    updateCollectionImages(activeCollectionId, (imgs) =>
      imgs.filter((img) => img.id !== imageId)
    );
  };

  // ========== RENDER ==========

  // --- Collections overview ---
  if (!activeCollection) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Brand <span className="text-gradient-gold">Collections</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1 font-body">
                Organise reference designs into collections
              </p>
            </div>
            <button
              onClick={() => setShowNewCollection(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-gold text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-gold"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </button>
          </div>

          {/* New collection form */}
          {showNewCollection && (
            <div className="mb-6 p-5 rounded-lg border border-border bg-card animate-fade-in">
              <p className="text-sm font-medium text-foreground mb-3 font-body">
                Create a new collection
              </p>
              <input
                autoFocus
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                placeholder="Collection name (e.g. Nike SS25)"
                className="w-full bg-secondary text-foreground text-sm px-4 py-2.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors font-body mb-2"
              />
              <input
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-secondary text-foreground text-sm px-4 py-2.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors font-body mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim()}
                  className="px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewCollection(false);
                    setNewCollectionName("");
                    setNewCollectionDesc("");
                  }}
                  className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Collection cards */}
          {collections.length === 0 && !showNewCollection ? (
            <div
              onClick={() => setShowNewCollection(true)}
              className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-24 cursor-pointer hover:border-primary/40 transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <FolderOpen className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-foreground font-medium font-body">
                Create your first collection
              </p>
              <p className="text-muted-foreground text-sm mt-1 font-body">
                Group brand reference images into themed collections
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {collections.map((col) => (
                <div
                  key={col.id}
                  onClick={() => setActiveCollectionId(col.id)}
                  className="group relative rounded-lg border border-border bg-card p-5 cursor-pointer hover:border-primary/40 transition-all"
                >
                  {/* Preview thumbnails */}
                  <div className="grid grid-cols-2 gap-1 mb-4 aspect-square rounded-md overflow-hidden bg-secondary">
                    {col.images.slice(0, 4).map((img) => (
                      <img
                        key={img.id}
                        src={img.src}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    ))}
                    {col.images.length === 0 && (
                      <div className="col-span-2 row-span-2 flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <h3 className="text-foreground font-medium text-sm font-body truncate">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="text-muted-foreground text-xs mt-0.5 font-body truncate">
                      {col.description}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs mt-1 font-body">
                    {col.images.length} image{col.images.length !== 1 ? "s" : ""}
                  </p>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(col.id);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete collection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add collection card */}
              <div
                onClick={() => setShowNewCollection(true)}
                className="rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors"
              >
                <Plus className="w-6 h-6 mb-2" />
                <span className="text-sm font-body">New Collection</span>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // --- Single collection view ---
  return (
    <Layout>
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCollectionId(null)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {activeCollection.name}
              </h1>
              {activeCollection.description && (
                <p className="text-muted-foreground text-sm mt-0.5 font-body">
                  {activeCollection.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScraper(!showScraper)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                showScraper
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:border-primary/40"
              }`}
            >
              <Globe className="w-4 h-4" />
              Scrape Store
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-gold text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-gold"
            >
              <Upload className="w-4 h-4" />
              Upload Images
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Scraper */}
        {showScraper && (
          <div className="mb-6 p-4 rounded-lg border border-border bg-card animate-fade-in">
            <p className="text-sm text-foreground font-medium mb-2 font-body">
              Enter an online store URL to extract product images into this
              collection
            </p>
            <div className="flex gap-2">
              <input
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScrapeStore()}
                placeholder="https://store.example.com/collection/..."
                className="flex-1 bg-secondary text-foreground text-sm px-4 py-2.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors font-body"
                disabled={scraping}
              />
              <button
                onClick={handleScrapeStore}
                disabled={scraping || !scrapeUrl.trim()}
                className="px-5 py-2.5 rounded-lg gradient-gold text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {scraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping…
                  </>
                ) : (
                  "Extract"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Images */}
        {activeCollection.images.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-24 cursor-pointer hover:border-primary/40 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <ImageIcon className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-foreground font-medium font-body">
              Drop images here or click to upload
            </p>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              PNG, JPG up to 10MB each — or use Scrape Store to import from a
              URL
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {activeCollection.images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                onAddAnnotation={handleAddAnnotation}
                onRemoveAnnotation={handleRemoveAnnotation}
                onDelete={handleDeleteImage}
              />
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-body">Add More</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GalleryPage;
