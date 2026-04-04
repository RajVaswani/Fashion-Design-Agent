import { useState, useRef } from "react";
import { Upload, ImageIcon } from "lucide-react";
import Layout from "@/components/Layout";
import ImageCard from "@/components/ImageCard";
import type { GalleryImage, Annotation } from "@/types/gallery";

const GalleryPage = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newImage: GalleryImage = {
          id: crypto.randomUUID(),
          src: ev.target?.result as string,
          name: file.name,
          annotations: [],
        };
        setImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-gold text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-gold"
          >
            <Upload className="w-4 h-4" />
            Upload Images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

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
              PNG, JPG up to 10MB each
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
