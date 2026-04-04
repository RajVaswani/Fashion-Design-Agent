import { useState, useCallback } from "react";
import { Sparkles, Download, Check, X, ZoomIn, StickyNote, FileText, Loader2, Trash2, Wand2, Target } from "lucide-react";
import type { GeneratedDesign, DesignStage } from "@/types/gallery";
import { projectsApi } from "@/lib/projectsApi";
import { Skeleton } from "@/components/ui/skeleton";

interface DesignResultsProps {
  designs: GeneratedDesign[];
  stage: DesignStage;
  selectable: boolean;
  onToggleSelect: (id: string) => void;
  onPromoteSelected: () => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onDeleteDesign?: (id: string) => void;
  onEnhanceDesign?: (id: string, enhancePrompt: string) => void;
  onFocusDesign?: (id: string) => void;
  focusedDesignId?: string | null;
  isGenerating?: boolean;
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
  onUpdateNotes,
  onDeleteDesign,
  onEnhanceDesign,
  isGenerating = false,
}: DesignResultsProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [viewingCitationId, setViewingCitationId] = useState<string | null>(null);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [enhancePrompt, setEnhancePrompt] = useState("");

  const stageDesigns = designs.filter((d) => d.stage === stage);
  const selectedCount = stageDesigns.filter((d) => d.selected).length;
  const nextStage: DesignStage | null = stage === "concept" ? "design" : stage === "design" ? "realistic" : null;

  const openNoteEditor = (design: GeneratedDesign) => {
    setEditingNoteId(design.id);
    setNoteText(design.notes || "");
  };

  const saveNote = useCallback(async () => {
    if (!editingNoteId) return;
    onUpdateNotes?.(editingNoteId, noteText);
    try {
      await projectsApi.updateDesignNotes(editingNoteId, noteText);
    } catch (err) {
      console.error("Failed to save note", err);
    }
    setEditingNoteId(null);
  }, [editingNoteId, noteText, onUpdateNotes]);

  if (stageDesigns.length === 0 && !isGenerating) {
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

  const LoadingCards = () => (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-border bg-card animate-pulse">
          <div className="aspect-[3/4] relative bg-secondary flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
            <p className="text-xs text-muted-foreground font-body">Generating…</p>
          </div>
          <div className="p-2 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );

  return (
    <>
      <div className="space-y-3">
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
          {isGenerating && <LoadingCards />}
          {stageDesigns.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-lg overflow-hidden border bg-card animate-fade-in transition-all ${
                item.selected ? "border-primary ring-1 ring-primary/30" : "border-border"
              }`}
            >
              <div
                className="aspect-[3/4] relative cursor-pointer"
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
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                </div>
                {selectable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                      item.selected
                        ? "bg-primary border-primary"
                        : "border-foreground/30 bg-background/40 backdrop-blur-sm opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {item.selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </button>
                )}
                {/* Note indicator */}
                {item.notes && (
                  <div className="absolute top-2 left-2 z-10">
                    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <StickyNote className="w-3 h-3 text-accent-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with prompt, note button, download */}
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate font-body max-w-[60%]">
                    {item.prompt}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Enhance button — design & realistic stages */}
                    {(stage === "design" || stage === "realistic") && onEnhanceDesign && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEnhancingId(item.id); setEnhancePrompt(""); }}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Enhance this design"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openNoteEditor(item); }}
                      className={`p-1 transition-colors ${item.notes ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      title="Add refinement notes"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingCitationId(item.id); }}
                      className={`p-1 transition-colors ${item.citation ? "text-primary/70 hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      title="View design citation"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={item.url}
                      download={`design-${item.id}.png`}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {onDeleteDesign && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteDesign(item.id); }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete design"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Show note preview if exists */}
                {item.notes && (
                  <p
                    className="text-[10px] text-accent-foreground/70 bg-accent/30 rounded px-1.5 py-0.5 line-clamp-2 cursor-pointer font-body"
                    onClick={() => openNoteEditor(item)}
                  >
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Citation viewer modal */}
      {viewingCitationId && (() => {
        const citationDesign = designs.find(d => d.id === viewingCitationId);
        return (
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewingCitationId(null)}
          >
            <div
              className="bg-card border border-border rounded-xl p-4 w-full max-w-md space-y-3 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  Design Citation
                </h3>
                <button onClick={() => setViewingCitationId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground font-body leading-relaxed whitespace-pre-wrap">
                {citationDesign?.citation || "No citation available."}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setViewingCitationId(null)}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Note editor modal */}
      {editingNoteId && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={saveNote}
        >
          <div
            className="bg-card border border-border rounded-xl p-4 w-full max-w-md space-y-3 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-foreground">Refinement Notes</h3>
              <button onClick={saveNote} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-body">
              Add notes about what to change, improve, or keep. These will be sent as instructions to the AI in the next stage.
            </p>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Make the neckline deeper, change fabric to silk, keep the sleeve length..."
              className="w-full h-32 bg-secondary border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setNoteText(""); setEditingNoteId(null); }}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Enhance prompt modal */}
      {enhancingId && (() => {
        const enhanceDesign = designs.find(d => d.id === enhancingId);
        return (
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEnhancingId(null)}
          >
            <div
              className="bg-card border border-border rounded-xl p-4 w-full max-w-md space-y-3 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-primary" />
                  Enhance Design
                </h3>
                <button onClick={() => setEnhancingId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {enhanceDesign && (
                <div className="rounded-lg overflow-hidden border border-border max-h-40">
                  <img src={enhanceDesign.url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground font-body">
                Describe what to change or enhance on this specific design. The AI will use this as focused instructions.
              </p>
              <textarea
                autoFocus
                value={enhancePrompt}
                onChange={(e) => setEnhancePrompt(e.target.value)}
                placeholder="e.g. Make the collar wider, add gold buttons, change to a deeper blue..."
                className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-body"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEnhancingId(null)}
                  className="px-3 py-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (enhancePrompt.trim() && onEnhanceDesign) {
                      onEnhanceDesign(enhancingId, enhancePrompt.trim());
                      setEnhancingId(null);
                    }
                  }}
                  disabled={!enhancePrompt.trim()}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  <Wand2 className="w-3 h-3 inline mr-1" /> Enhance
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default DesignResults;
