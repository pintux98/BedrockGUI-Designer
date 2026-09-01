import React from "react";
import { BufferedInput } from "../components/BufferedInput";

interface InlineTextEditorProps {
  value: string;
  placeholder?: string;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}

export function InlineTextEditor({ value, placeholder, maxLength, onSubmit, onCancel, className = "" }: InlineTextEditorProps) {
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (draft !== value) {
      onSubmit(draft);
    } else {
      onCancel();
    }
  };

  return (
    <textarea
      ref={inputRef}
      className={`w-full bg-[#1e1e1f] border-2 border-brand-accent px-2 py-1 text-white text-base font-minecraft font-smooth-none outline-none resize-none ${className}`}
      value={draft}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      rows={1}
      style={{ minHeight: "1.5em" }}
    />
  );
}
