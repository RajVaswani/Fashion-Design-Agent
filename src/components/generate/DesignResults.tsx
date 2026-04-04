import { useState } from "react";
import { Sparkles, Download, Check, X, ZoomIn } from "lucide-react";
import type { GeneratedDesign, DesignStage } from "@/types/gallery";

interface DesignResultsProps {
  designs: GeneratedDesign[];
  stage: DesignStage;
  selectable: boolean;
  onToggleSelect: (id: string) => void;
  onPromoteSelected: () => void;
}

const stageLabels: Record<DesignStage, string> = {
  concept: "Concepts",
  design: "Refined Designs",
  realistic: "Realistic Renders",
};

const DesignResults = ({
  designs,
  stage,
  selectable,
  onToggleSelect,
  onPromoteSelected,
}: DesignResultsProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const stageDesigns = designs.filter((d) => d.stage === stage);
  const selectedCount = stageDesigns.filter((d) => d.selected).length;
  const nextStage: DesignStage | null = stage === "concept" ? "design" : stage === "design" ? "realistic" : null;

  if (stageDesigns.length === 0) {
    return (
      <div className="border border-border rounded-xl flex flex-col items-center justify-center py-20 bg-card/50">
        <Sparkles className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm font-body">
          {stage === "concept"
            ? "Generate concepts to get started"
            : stage === "design"
            ? "Select concepts and refine them here"
            : "Select designs to render realistically"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Selection summary bar */}
        {selectable && (
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground font-body">
              {selectedCount} of {stageDesigns.length} selected
            </span>
            {selectedCount > 0 && nextStage && (
              <button
                onClick={onPromoteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90 transition-colors"
              >
                Move to {stageLabels[nextStage]} →
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {stageDesigns.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-lg overflow-hidden border bg-card animate-fade-in transition-all cursor-pointer ${
                item.selected ? "border-primary ring-1 ring-primary/30" : "border-border"
              }`}
            >
              <div
                className="aspect-[3/4] relative"
                onClick={() => setPreviewUrl(item.url)}
              >
                <img
                  src={item.url}
                  alt={item.prompt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                {/* Zoom overlay */}
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                </div>
                {/* Select checkbox */}
                {selectable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(item.id);
                    }}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                      item.selected
                        ? "bg-primary border-primary"
                        : "border-foreground/30 bg-background/40 backdrop-blur-sm opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {item.selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </button>
                )}
              </div>
              <div className="p-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate font-body max-w-[80%]">
                  {item.prompt}
                </span>
                <a
                  href={item.url}
                  download={`design-${item.id}.png`}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-10 right-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewUrl}
              alt="Design preview"
              className="w-full h-full object-contain rounded-lg"
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <a
                href={previewUrl}
                download="design.png"
                className="px-3 py-1.5 rounded-md bg-card border border-border text-xs font-body text-foreground hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5 inline mr-1" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DesignResults;
