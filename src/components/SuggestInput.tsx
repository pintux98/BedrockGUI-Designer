import React from "react";
import { useMinecraftData } from "../data/useMinecraftData";

export type SuggestSource = "sound" | "item" | string[];

export function useSuggestions(source: SuggestSource): string[] {
  const data = useMinecraftData();
  if (Array.isArray(source)) return source;
  if (!data) return [];
  return source === "sound" ? data.SOUNDS : data.ITEMS;
}

export function SuggestInput({
  source,
  ref,
  ...props
}: { source: SuggestSource; ref?: React.Ref<HTMLInputElement> } & React.InputHTMLAttributes<HTMLInputElement>) {
  const listId = React.useId();
  const options = useSuggestions(source);
  return (
    <>
      <input ref={ref} {...props} list={listId} autoComplete="off" spellCheck={false} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
