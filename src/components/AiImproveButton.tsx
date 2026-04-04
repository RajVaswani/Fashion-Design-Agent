import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AiImproveButtonProps {
  text: string;
  context: "project-description" | "collection-description" | "design-prompt" | "default";
  onImproved: (improved: string) => void;
  disabled?: boolean;
  className?: string;
}

const AiImproveButton = ({ text, context, onImproved, disabled, className = "" }: AiImproveButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleImprove = async () => {
    if (!text.trim()) {
      toast.error("Type something first, then improve it with AI");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-text", {
        body: { text: text.trim(), context },
      });
      if (error) throw error;
      if (data?.improved) {
        onImproved(data.improved);
        toast.success("Text improved!");
      } else {
        toast.error("Could not improve text");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to improve text");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleImprove}
      disabled={disabled || loading || !text.trim()}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-body font-medium transition-all
        bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      title="Improve with AI"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
      Improve
    </button>
  );
};

export default AiImproveButton;
