import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, MessageSquare, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MoodBoardAnnotation {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
}

interface MoodBoardPage {
  id: string;
  pageNumber: number;
  imageUrl: string; // blob URL or uploaded URL
  selected: boolean;
  annotations: MoodBoardAnnotation[];
}

interface MoodBoardUploaderProps {
  onPagesReady: (pages: { src: string; annotations: MoodBoardAnnotation[] }[]) => void;
}

const MoodBoardUploader = ({ onPagesReady }: MoodBoardUploaderProps) => {
  const [pages, setPages] = useState<MoodBoardPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [activePage, setActivePage] = useState<string | null>(null);
  const [annotatingPage, setAnnotatingPage] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const renderPdfPages = useCallback(async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, 20); // Max 20 pages

      const renderedPages: MoodBoardPage[] = [];
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
        );
        const blobUrl = URL.createObjectURL(blob);

        renderedPages.push({
          id: crypto.randomUUID(),
          pageNumber: i,
          imageUrl: blobUrl,
          selected: false,
          annotations: [],
        });
      }

      setPages(renderedPages);
      toast.success(`${totalPages} page(s) loaded from PDF`);
    } catch (err) {
      console.error("PDF render error:", err);
      toast.error("Failed to load PDF. Make sure it's a valid PDF file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }
    renderPdfPages(file);
  };

  const togglePageSelect = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>, pageId: string) => {
    if (annotatingPage !== pageId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (annotationText.trim()) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                annotations: [
                  ...p.annotations,
                  { id: crypto.randomUUID(), text: annotationText.trim(), x, y },
                ],
              }
            : p
        )
      );
      setAnnotationText("");
    } else {
      toast.error("Type your annotation text first, then click on the image");
    }
  };

  const removeAnnotation = (pageId: string, annotationId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, annotations: p.annotations.filter((a) => a.id !== annotationId) }
          : p
      )
    );
  };

  const handleUseSelected = async () => {
    const selected = pages.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.error("Select at least one page");
      return;
    }

    // Upload selected pages to storage so they can be used as reference URLs
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const folder = user?.id || "anonymous";
      const results: { src: string; annotations: MoodBoardAnnotation[] }[] = [];

      for (const page of selected) {
        // Fetch blob from blob URL
        const resp = await fetch(page.imageUrl);
        const blob = await resp.blob();
        const fileName = `${folder}/moodboard-${crypto.randomUUID()}.jpg`;

        const { error } = await supabase.storage
          .from("design-outputs")
          .upload(fileName, blob, { contentType: "image/jpeg" });

        if (error) {
          console.error("Upload error:", error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("design-outputs")
          .getPublicUrl(fileName);

        results.push({ src: urlData.publicUrl, annotations: page.annotations });
      }

      onPagesReady(results);
      toast.success(`${results.length} mood board page(s) added as references`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload mood board pages");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    pages.forEach((p) => URL.revokeObjectURL(p.imageUrl));
    setPages([]);
    setFileName("");
    setActivePage(null);
    setAnnotatingPage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Zoomed-in view of a single page
  const activePageData = activePage ? pages.find((p) => p.id === activePage) : null;

  return (
    <div className="space-y-3">
      {pages.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-body">Processing PDF…</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground font-body">Upload Mood Board PDF</p>
              <p className="text-xs text-muted-foreground font-body mt-1">Brief, lookbook, or inspiration board (max 20 pages)</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground font-body">{fileName}</span>
              <span className="text-[10px] text-muted-foreground font-body">
                ({pages.filter((p) => p.selected).length}/{pages.length} selected)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUseSelected}
                disabled={loading || pages.filter((p) => p.selected).length === 0}
                className="px-3 py-1.5 rounded-lg gradient-gold text-primary-foreground text-[11px] font-medium disabled:opacity-50 font-body"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use Selected"}
              </button>
              <button
                onClick={clearAll}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Zoomed view */}
          {activePageData && (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-foreground font-body">
                  Page {activePageData.pageNumber}
                  {annotatingPage === activePageData.id && (
                    <span className="text-primary ml-2">— Click image to place annotation</span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setAnnotatingPage(
                        annotatingPage === activePageData.id ? null : activePageData.id
                      )
                    }
                    className={`p-1 rounded transition-colors ${
                      annotatingPage === activePageData.id
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Annotate"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setActivePage(null); setAnnotatingPage(null); }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Annotation text input */}
              {annotatingPage === activePageData.id && (
                <div className="px-3 py-2 border-b border-border">
                  <input
                    type="text"
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Type annotation, then click on image to place it…"
                    className="w-full bg-secondary text-foreground text-xs px-3 py-2 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 font-body"
                  />
                </div>
              )}

              <div
                ref={imageContainerRef}
                className="relative cursor-crosshair"
                onClick={(e) => handleImageClick(e, activePageData.id)}
              >
                <img
                  src={activePageData.imageUrl}
                  alt={`Page ${activePageData.pageNumber}`}
                  className="w-full"
                />
                {/* Annotation dots */}
                {activePageData.annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="absolute group"
                    style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: "translate(-50%, -50%)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                      <span className="text-[8px] font-bold text-primary-foreground">
                        {activePageData.annotations.indexOf(ann) + 1}
                      </span>
                    </div>
                    <div className="absolute left-6 top-0 hidden group-hover:block z-10 bg-popover border border-border rounded-md px-2 py-1 shadow-lg min-w-[120px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-foreground font-body">{ann.text}</span>
                        <button
                          onClick={() => removeAnnotation(activePageData.id, ann.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Annotation list */}
              {activePageData.annotations.length > 0 && (
                <div className="px-3 py-2 border-t border-border space-y-1">
                  {activePageData.annotations.map((ann, i) => (
                    <div key={ann.id} className="flex items-center justify-between text-[10px]">
                      <span className="text-foreground font-body">
                        <span className="text-primary font-medium">{i + 1}.</span> {ann.text}
                      </span>
                      <button
                        onClick={() => removeAnnotation(activePageData.id, ann.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Page grid */}
          <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
                  page.selected
                    ? "border-primary shadow-sm"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <img
                  src={page.imageUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full aspect-[3/4] object-cover"
                  onClick={() => togglePageSelect(page.id)}
                />
                <div className="absolute top-1 right-1 flex gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActivePage(page.id); }}
                    className="p-1 rounded bg-background/80 text-foreground hover:bg-background transition-colors"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1.5 py-0.5 flex items-center justify-between">
                  <span className="text-[9px] text-foreground font-body">p.{page.pageNumber}</span>
                  {page.annotations.length > 0 && (
                    <span className="text-[9px] text-primary font-body">
                      {page.annotations.length} note{page.annotations.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default MoodBoardUploader;
