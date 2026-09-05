import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

/**
 * An optional button rendered inside the toast.
 *
 * This exists because ctrl+z is scoped to the form on screen and never reaches
 * project history, so a structural change (add / rename / duplicate / delete a
 * form, assets, platform target) needs somewhere to offer its own undo at the
 * moment it happens. `ToastHost` dismisses the toast after running `onClick`.
 */
export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useToastStore = create<{
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">, ttlMs?: number) => void;
  dismiss: (id: string) => void;
}>(() => ({
  toasts: [],
  push: (t, ttlMs = 2500) => {
    const id = uid();
    useToastStore.setState((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    window.setTimeout(() => {
      useToastStore.getState().dismiss(id);
    }, ttlMs);
  },
  dismiss: (id) => useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}));

export const toast = {
  success(message: string, ttlMs?: number, action?: ToastAction) {
    useToastStore.getState().push({ message, variant: "success", action }, ttlMs);
  },
  error(message: string, ttlMs?: number, action?: ToastAction) {
    useToastStore.getState().push({ message, variant: "error", action }, ttlMs);
  },
  info(message: string, ttlMs?: number, action?: ToastAction) {
    useToastStore.getState().push({ message, variant: "info", action }, ttlMs);
  }
};

