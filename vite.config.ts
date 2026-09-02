import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 5173,
    open: false
  },
  preview: {
    port: 5174
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@dnd-kit")) return "dnd";
          if (id.includes("zod")) return "zod";
          if (id.includes("zustand")) return "zustand";
          if (id.includes("js-yaml")) return "yaml";
          if (id.includes("fflate")) return "fflate";
          return "vendor";
        }
      }
    }
  },
  plugins: [
    react()
  ]
});

