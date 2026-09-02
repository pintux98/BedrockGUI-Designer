import { useEffect } from "react";
import { useDesignerStore } from "../core/store";

/**
 * True for anywhere the browser already owns undo — a text field's own edit
 * history. Hijacking ctrl+z there would revert a form edit the user could not
 * see instead of the character they just typed.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Global undo/redo keyboard shortcuts.
 *
 * `FormSwitcher` tells the user "You can undo this with Ctrl+Z" and the TopBar
 * buttons are titled "Undo (Ctrl+Z)" / "Redo (Ctrl+Y)". Until this existed both
 * were false: nothing in the app listened for either chord.
 */
export function useUndoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isTextEntry(event.target)) return;

      const key = event.key.toLowerCase();
      // ctrl+shift+z is the redo chord on platforms that lack ctrl+y.
      const isRedo = key === "y" || (key === "z" && event.shiftKey);
      const isUndo = key === "z" && !event.shiftKey;
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      const state = useDesignerStore.getState();
      if (isRedo) state.redo();
      else state.undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
