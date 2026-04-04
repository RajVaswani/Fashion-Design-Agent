import { useState, useRef, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceToTextButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

const VoiceToTextButton = ({ onTranscript, disabled, className = "" }: VoiceToTextButtonProps) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      onTranscript(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        toast.error("Microphone error: " + event.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
    toast.success("Listening… speak your prompt");
  }, [listening, onTranscript]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-body font-medium transition-all
        ${listening
          ? "bg-destructive/20 text-destructive animate-pulse"
          : "bg-primary/10 text-primary hover:bg-primary/20"
        } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      title={listening ? "Stop listening" : "Voice input"}
    >
      {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
      {listening ? "Stop" : "Voice"}
    </button>
  );
};

export default VoiceToTextButton;
