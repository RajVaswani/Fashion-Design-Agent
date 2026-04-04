import { Sparkles, Download, Check } from "lucide-react";
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
    <div className="space-y-3">
      {selectable && selectedCount > 0 && nextStage && (
        <button
          onClick={onPromoteSelected}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-body font-medium hover:bg-primary/20 transition-colors"
        >
          Move {selectedCount} selected → {stageLabels[nextStage]}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {stageDesigns.map((item) => (
          <div
            key={item.id}
            className={`group relative rounded-lg overflow-hidden border bg-card animate-fade-in transition-all ${
              item.selected ? "border-primary ring-1 ring-primary/30" : "border-border"
            }`}
          >
            <div className="aspect-[3/4] relative">
              <img
                src={item.url}
                alt={item.prompt}
                className="w-full h-full object-cover"
              />
              {selectable && (
                <button
                  onClick={() => onToggleSelect(item.id)}
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
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DesignResults;
