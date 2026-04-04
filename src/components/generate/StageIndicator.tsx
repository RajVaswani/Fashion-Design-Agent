import type { DesignStage } from "@/types/gallery";
import { Lightbulb, Paintbrush, Camera } from "lucide-react";

const stages: { key: DesignStage; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "concept", label: "Concept", icon: Lightbulb, desc: "Explore ideas" },
  { key: "design", label: "Design", icon: Paintbrush, desc: "Refine details" },
  { key: "realistic", label: "Realistic", icon: Camera, desc: "Final renders" },
];

interface StageIndicatorProps {
  current: DesignStage;
  onChange: (stage: DesignStage) => void;
}

const StageIndicator = ({ current, onChange }: StageIndicatorProps) => {
  const currentIdx = stages.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1 w-full">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        const isActive = stage.key === current;
        const isPast = i < currentIdx;

        return (
          <div key={stage.key} className="flex items-center flex-1">
            <button
              onClick={() => onChange(stage.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full ${
                isActive
                  ? "bg-primary/15 border border-primary text-primary"
                  : isPast
                  ? "bg-primary/5 border border-primary/30 text-primary/70"
                  : "border border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs font-medium font-body truncate">{stage.label}</p>
                <p className="text-[10px] opacity-70 font-body truncate">{stage.desc}</p>
              </div>
            </button>
            {i < stages.length - 1 && (
              <div className={`w-4 h-px mx-1 flex-shrink-0 ${isPast ? "bg-primary/50" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StageIndicator;
