import { useState } from "react";
import { Check, MessageCircle, X, Plus } from "lucide-react";
import type { GalleryImage, Annotation } from "@/types/gallery";

interface ImageCardProps {
  image: GalleryImage;
  selectable?: boolean;
  onToggleSelect?: (id: string) => void;
  onAddAnnotation?: (id: string, annotation: Annotation) => void;
  onRemoveAnnotation?: (id: string, annotationId: string) => void;
}

const ImageCard = ({
  image,
  selectable = false,
  onToggleSelect,
  onAddAnnotation,
  onRemoveAnnotation,
}: ImageCardProps) => {
  const [annotating, setAnnotating] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState("");
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!annotating) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setClickPos({ x, y });
  };

  const saveAnnotation = () => {
    if (!clickPos || !newAnnotationText.trim()) return;
    onAddAnnotation?.(image.id, {
      id: crypto.randomUUID(),
      text: newAnnotationText.trim(),
      x: clickPos.x,
      y: clickPos.y,
    });
    setNewAnnotationText("");
    setClickPos(null);
  };

  return (
    <div className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300">
      {/* Image area */}
      <div
        className="relative aspect-[3/4] overflow-hidden cursor-crosshair"
        onClick={handleImageClick}
      >
        <img
          src={image.src}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Annotation pins */}
        {(showAnnotations || annotating) &&
          image.annotations.map((ann) => (
            <div
              key={ann.id}
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-primary border-2 border-primary-foreground flex items-center justify-center cursor-pointer z-10 animate-fade-in"
              style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
              title={ann.text}
            >
              <span className="text-[8px] font-bold text-primary-foreground">!</span>
              {onRemoveAnnotation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAnnotation(image.id, ann.id);
                  }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2 h-2 text-destructive-foreground" />
                </button>
              )}
            </div>
          ))}

        {/* New annotation input */}
        {clickPos && annotating && (
          <div
            className="absolute z-20 animate-fade-in"
            style={{ left: `${clickPos.x}%`, top: `${clickPos.y}%` }}
          >
            <div className="relative -translate-x-1/2 mt-2 bg-card border border-border rounded-lg p-2 shadow-lg min-w-[180px]">
              <input
                autoFocus
                value={newAnnotationText}
                onChange={(e) => setNewAnnotationText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveAnnotation()}
                placeholder="Add note..."
                className="w-full bg-secondary text-foreground text-xs px-2 py-1.5 rounded border-none outline-none placeholder:text-muted-foreground"
              />
              <div className="flex gap-1 mt-1.5">
                <button
                  onClick={saveAnnotation}
                  className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={() => setClickPos(null)}
                  className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:opacity-90"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selection overlay */}
        {selectable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(image.id);
            }}
            className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
              image.selected
                ? "bg-primary border-primary"
                : "border-foreground/30 bg-background/40 backdrop-blur-sm opacity-0 group-hover:opacity-100"
            }`}
          >
            {image.selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate font-body">{image.name}</span>
        <div className="flex items-center gap-1">
          {image.annotations.length > 0 && (
            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`p-1 rounded transition-colors ${
                showAnnotations ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {onAddAnnotation && (
            <button
              onClick={() => {
                setAnnotating(!annotating);
                setClickPos(null);
              }}
              className={`p-1 rounded transition-colors ${
                annotating ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Annotate"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
