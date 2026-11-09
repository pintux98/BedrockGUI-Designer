import React from "react";
import { DesignerShell } from "./app/DesignerShell";
import { ToastHost } from "./components/ToastHost";
import { ConfirmDialog } from "./components/ConfirmDialog";

export default function App() {
  return (
    <>
      <DesignerShell />
      <ToastHost />
      <ConfirmDialog />
    </>
  );
}
