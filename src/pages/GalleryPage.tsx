import { useState, useRef } from "react";
import { Upload, ImageIcon, Globe, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import ImageCard from "@/components/ImageCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GalleryImage, Annotation } from "@/types/gallery";

const GalleryPage = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [showScraper, setShowScraper] = useState(false);
  const [scraping, setScraping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track sources to avoid duplicates (by normalized src or file name)
  const getImageKey = (src: string, name: string) => {
    // For URLs, use the URL path; for uploads, use file name
    try {
      const url = new URL(src);
      return url.pathname;
    } catch {
      return name;
    }
  };

  const isDuplicate = (src: string, name: string) => {
    const key = getImageKey(src, name);
    return images.some((img) => getImageKey(img.src, img.name) === key);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    let addedCount = 0;
    let skippedCount = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        // Check duplicate by file name for uploads
        setImages((prev) => {
          if (prev.some((img) => img.name === file.name)) {
            skippedCount++;
            return prev;
          }
          addedCount++;
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              src,
              name: file.name,
              annotations: [],
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleScrapeStore = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-store", {
        body: { url: scrapeUrl.trim() },
      });

      if (error) throw error;

      const scraped = data?.images as { src: string; description: string }[] || [];
      if (scraped.length === 0) {
        toast.info("No images found on this page");
        setScraping(false);
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      setImages((prev) => {
        const existingKeys = new Set(prev.map((img) => getImageKey(img.src, img.name)));
        const newImages: GalleryImage[] = [];

        for (const img of scraped) {
          const key = getImageKey(img.src, img.src.split("/").pop() || "image");
          if (existingKeys.has(key)) {
            skippedCount++;
            continue;
          }
          existingKeys.add(key);

          const fileName = img.src.split("/").pop()?.split("?")[0] || "image";
          const annotation: Annotation | null = img.description
            ? {
                id: crypto.randomUUID(),
                text: img.description,
                x: 50,
                y: 90,
              }
            : null;

          newImages.push({
            id: crypto.randomUUID(),
            src: img.src,
            name: fileName,
            annotations: annotation ? [annotation] : [],
          });
          addedCount++;
        }

        return [...prev, ...newImages];
      });

      toast.success(`Added ${addedCount} images${skippedCount > 0 ? `, ${skippedCount} duplicates skipped` : ""}`);
      setScrapeUrl("");
      setShowScraper(false);
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(err.message || "Failed to scrape store");
    } finally {
      setScraping(false);
    }
  };

  const handleAddAnnotation = (imageId: string, annotation: Annotation) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, annotations: [...img.annotations, annotation] }
          : img
      )
    );
  };

  const handleRemoveAnnotation = (imageId: string, annotationId: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, annotations: img.annotations.filter((a) => a.id !== annotationId) }
          : img
      )
    );
  };

  const handleDeleteImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  return (
    <Layout>
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Brand <span className="text-gradient-gold">Collection</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              Upload reference designs and annotate key details
            </p>
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

        {/* Scraper input */}
        {showScraper && (
          <div className="mb-6 p-4 rounded-lg border border-border bg-card animate-fade-in">
            <p className="text-sm text-foreground font-medium mb-2 font-body">
              Enter an online store URL to extract product images
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

        {/* Gallery */}
        {images.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-24 cursor-pointer hover:border-primary/40 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <ImageIcon className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-foreground font-medium font-body">Drop images here or click to upload</p>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              PNG, JPG up to 10MB each — or use Scrape Store to import from a URL
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                onAddAnnotation={handleAddAnnotation}
                onRemoveAnnotation={handleRemoveAnnotation}
                onDelete={handleDeleteImage}
              />
            ))}
            {/* Add more card */}
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
