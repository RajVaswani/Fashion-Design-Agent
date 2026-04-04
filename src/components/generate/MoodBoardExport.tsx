import { useState, useRef, useCallback } from "react";
import { X, Download, Loader2, FileImage, Eye } from "lucide-react";
import type { GeneratedDesign, DesignStage } from "@/types/gallery";
import jsPDF from "jspdf";

interface MoodBoardExportProps {
  designs: GeneratedDesign[];
  projectName: string;
  masterPrompt?: string;
  onClose: () => void;
}

const STAGE_LABELS: Record<DesignStage, string> = {
  concept: "Concepts",
  design: "Design Details",
  realistic: "Final Renders",
  moodboard: "Mood Board",
};

const MoodBoardExport = ({ designs, projectName, masterPrompt, onClose }: MoodBoardExportProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const pdfRef = useRef<jsPDF | null>(null);

  // Group designs by stage, only selected or from realistic
  const conceptDesigns = designs.filter((d) => d.stage === "concept" && d.selected);
  const designDesigns = designs.filter((d) => d.stage === "design" && d.selected);
  const realisticDesigns = designs.filter((d) => d.stage === "realistic");

  const selectedRealistic = realisticDesigns.filter((d) => d.selected);
  const finalDesigns = selectedRealistic.length > 0 ? selectedRealistic : realisticDesigns;

  const loadImageAsDataUrl = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
  };

  const buildPdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const H = 297;
      const margin = 15;
      const contentW = W - margin * 2;
      const pages: string[] = [];

      const capturePagePreview = () => {
        const pageData = pdf.output("datauristring");
        // We'll capture simplified previews via canvas later
      };

      // ===== COVER PAGE =====
      pdf.setFillColor(15, 23, 42); // dark bg
      pdf.rect(0, 0, W, H, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(32);
      pdf.setFont("helvetica", "bold");
      pdf.text(projectName || "Mood Board", margin, 80);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(180, 180, 200);
      pdf.text("Design Mood Board", margin, 95);

      if (masterPrompt) {
        pdf.setFontSize(10);
        pdf.setTextColor(160, 160, 180);
        const promptLines = pdf.splitTextToSize(masterPrompt, contentW);
        pdf.text(promptLines.slice(0, 6), margin, 115);
      }

      // Stats
      pdf.setFontSize(9);
      pdf.setTextColor(140, 140, 160);
      const stats = [
        `${conceptDesigns.length} Concepts`,
        `${designDesigns.length} Design Details`,
        `${finalDesigns.length} Final Renders`,
      ];
      pdf.text(stats.join("  •  "), margin, H - 30);
      pdf.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), margin, H - 22);

      // Helper: add image grid page
      const addImageGridPage = async (title: string, subtitle: string, items: GeneratedDesign[], cols: number) => {
        if (items.length === 0) return;
        pdf.addPage();

        // Header
        pdf.setFillColor(250, 250, 252);
        pdf.rect(0, 0, W, 35, "F");
        pdf.setTextColor(30, 30, 50);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin, 22);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 120, 140);
        pdf.text(subtitle, margin, 30);

        let y = 42;
        const gap = 4;
        const imgW = (contentW - gap * (cols - 1)) / cols;
        const imgH = imgW * 1.33;

        for (let i = 0; i < items.length; i++) {
          const col = i % cols;
          const x = margin + col * (imgW + gap);

          if (col === 0 && i > 0) {
            y += imgH + 18;
          }

          // New page if overflowing
          if (y + imgH + 15 > H - margin) {
            pdf.addPage();
            y = margin + 5;
          }

          try {
            const dataUrl = await loadImageAsDataUrl(items[i].url);
            // Image with rounded appearance (clip via rect)
            pdf.setDrawColor(220, 220, 230);
            pdf.setLineWidth(0.3);
            pdf.addImage(dataUrl, "JPEG", x, y, imgW, imgH);
            pdf.rect(x, y, imgW, imgH, "S");
          } catch {
            pdf.setFillColor(240, 240, 245);
            pdf.rect(x, y, imgW, imgH, "F");
            pdf.setTextColor(180, 180, 190);
            pdf.setFontSize(8);
            pdf.text("Image unavailable", x + imgW / 2, y + imgH / 2, { align: "center" });
          }

          // Caption below image
          const captionY = y + imgH + 3;
          pdf.setTextColor(80, 80, 100);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          const promptText = items[i].prompt.substring(0, 60) + (items[i].prompt.length > 60 ? "…" : "");
          pdf.text(promptText, x, captionY);

          if (items[i].notes) {
            pdf.setTextColor(120, 100, 60);
            pdf.setFontSize(6);
            const noteText = "Note: " + (items[i].notes || "").substring(0, 50);
            pdf.text(noteText, x, captionY + 4);
          }
        }
      };

      // ===== CONCEPT PAGE =====
      await addImageGridPage("Concepts", "Initial design explorations and mood references", conceptDesigns, 3);

      // ===== DESIGN DETAILS PAGE =====
      await addImageGridPage("Design Details", "Refined flat drawings, construction & technical details", designDesigns, 2);

      // ===== FINAL RENDERS PAGE =====
      await addImageGridPage("Final Renders", "Photorealistic model shoots and product imagery", finalDesigns, 2);

      // ===== DETAILS / CITATIONS PAGE =====
      const allWithCitation = [...conceptDesigns, ...designDesigns, ...finalDesigns].filter((d) => d.citation);
      if (allWithCitation.length > 0) {
        pdf.addPage();
        pdf.setFillColor(250, 250, 252);
        pdf.rect(0, 0, W, 35, "F");
        pdf.setTextColor(30, 30, 50);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text("Design Notes & Citations", margin, 22);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 120, 140);
        pdf.text("AI generation context and design rationale", margin, 30);

        let y = 42;
        for (const d of allWithCitation) {
          if (y > H - 40) {
            pdf.addPage();
            y = margin + 5;
          }
          pdf.setTextColor(50, 50, 70);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${STAGE_LABELS[d.stage]} — ${d.prompt.substring(0, 50)}`, margin, y);
          y += 5;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 120);
          pdf.setFontSize(7);
          const citationLines = pdf.splitTextToSize(d.citation || "", contentW);
          pdf.text(citationLines.slice(0, 8), margin, y);
          y += citationLines.slice(0, 8).length * 3.5 + 6;
        }
      }

      pdfRef.current = pdf;

      // Generate preview images from each page
      const totalPages = pdf.getNumberOfPages();
      const previews: string[] = [];
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        // Use a lower-res output for preview
        const pageCanvas = document.createElement("canvas");
        const scale = 1.5;
        pageCanvas.width = Math.round(W * scale * 3.78); // mm to px approx
        pageCanvas.height = Math.round(H * scale * 3.78);
        // jsPDF doesn't have native canvas output, so we use data URI of each page
        // We'll use the full PDF output and show page thumbnails via an embedded object
      }

      // For preview, we'll convert each page to an image using a simpler approach
      // Create per-page PDFs for preview
      for (let i = 1; i <= totalPages; i++) {
        const singlePage = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        // Copy page content - jsPDF doesn't support this easily, so we use the blob
        // Instead, output the full PDF as data URL for preview
      }

      // Just use the full PDF data URL for an embedded preview
      const pdfDataUrl = pdf.output("datauristring");
      setPreviewPages([pdfDataUrl]);
      setShowPreview(true);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsGenerating(false);
    }
  }, [designs, projectName, masterPrompt, conceptDesigns, designDesigns, finalDesigns]);

  const handleDownload = () => {
    if (pdfRef.current) {
      pdfRef.current.save(`${projectName || "moodboard"}-mood-board.pdf`);
    }
  };

  const totalSelected = conceptDesigns.length + designDesigns.length + finalDesigns.length;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-display font-bold text-foreground">Generate Mood Board PDF</h2>
              <p className="text-[11px] text-muted-foreground font-body">{totalSelected} designs across all stages</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary of what's included */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { stage: "concept" as DesignStage, items: conceptDesigns, color: "bg-blue-500/10 text-blue-400" },
              { stage: "design" as DesignStage, items: designDesigns, color: "bg-amber-500/10 text-amber-400" },
              { stage: "realistic" as DesignStage, items: finalDesigns, color: "bg-emerald-500/10 text-emerald-400" },
            ]).map(({ stage, items, color }) => (
              <div key={stage} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-body font-medium px-2 py-0.5 rounded-full ${color}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground font-body">{items.length}</span>
                </div>
                {items.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {items.slice(0, 6).map((d) => (
                      <div key={d.id} className="aspect-[3/4] rounded overflow-hidden border border-border">
                        <img src={d.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {items.length > 6 && (
                      <div className="aspect-[3/4] rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                        +{items.length - 6}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground font-body">No selected designs</p>
                )}
              </div>
            ))}
          </div>

          {/* Preview area */}
          {showPreview && previewPages.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden bg-secondary/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
                <span className="text-xs font-body font-medium text-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> PDF Preview
                </span>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90"
                >
                  <Download className="w-3 h-3" /> Download PDF
                </button>
              </div>
              <div className="p-3">
                <iframe
                  src={previewPages[0]}
                  className="w-full rounded border border-border bg-white"
                  style={{ height: "500px" }}
                  title="Mood Board Preview"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs font-body text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          {!showPreview ? (
            <button
              onClick={buildPdf}
              disabled={isGenerating || totalSelected === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-body font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating PDF…</>
              ) : (
                <><Eye className="w-3.5 h-3.5" /> Preview Mood Board</>
              )}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-xs font-body font-medium hover:opacity-90 glow-gold"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoodBoardExport;
