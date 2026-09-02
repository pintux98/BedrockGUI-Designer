import { useEffect } from "react";
import { useDesignerStore } from "../core/store";

/**
 * Input types that carry a caret and therefore a browser-owned edit history.
 *
 * `<input>` with no `type` attribute (or an empty one) defaults to text, so it
 * belongs here too. Everything left out — checkbox, radio, number, range, date,
 * color, file — has no native undo, so intercepting ctrl+z there costs the user
 * nothing and refusing to would silently drop the keystroke.
 */
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password"]);

/**
 * Whether the caret sits inside an editable region.
 *
 * `isContentEditable` is the right API but is not universally implemented —
 * jsdom leaves it undefined, so the tests below could not see this branch at all
 * — and the attribute walk is the portable fallback. `closest` also covers a
 * target nested inside the editable host rather than being the host itself.
 */
function isContentEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  return el.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * True only where the browser already owns undo — a text field's own edit
 * history. Hijacking ctrl+z there would revert a form edit the user could not
 * see instead of the character they just typed.
 *
 * `<select>` is deliberately NOT here: it has no edit history of its own, so the
 * guard's rationale does not reach it, and including it made ctrl+z a no-op
 * after any dropdown change until the user clicked away.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (isContentEditable(target)) return true;
  if (target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const type = target.getAttribute("type");
  if (type === null || type.trim() === "") return true;
  return TEXT_INPUT_TYPES.has(type.trim().toLowerCase());
}

/**
 * True while any modal is on screen.
 *
 * Read from the live DOM rather than a flag, so it cannot go stale: `Dialog` is
 * the only thing in the app that renders `role="dialog"`, it renders through a
 * portal, and it returns null when closed — so the node exists exactly while a
 * modal does. That covers `ConfirmDialog`, `Wizard`, `MobileWarning` and
 * `ConfigSnippetDialog`, all of which are built on it.
 *
 * Without this, `Dialog` focusing its first button meant `isTextEntry` was false
 * and ctrl+z reverted an unrelated earlier edit behind the open dialog — worst
 * of all behind `FormSwitcher`'s delete confirmation, whose text is
 * "You can undo this with Ctrl+Z".
 */
function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
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
      // altKey bails out first, and stays that way: ctrl+alt+z is not an undo
      // chord on any platform, and AltGr on European layouts reports ctrlKey
      // AND altKey, so accepting it would fire undo on AltGr+z / AltGr+y.
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

      const key = event.key.toLowerCase();
      // ctrl+shift+z is the redo chord on platforms that lack ctrl+y.
      const isRedo = key === "y" || (key === "z" && event.shiftKey);
      const isUndo = key === "z" && !event.shiftKey;
      if (!isUndo && !isRedo) return;

      if (isModalOpen()) return;
      if (isTextEntry(event.target)) return;

      event.preventDefault();
      const state = useDesignerStore.getState();
      if (isRedo) state.redo();
      else state.undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
