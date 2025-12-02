import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const COPYRIGHT_BANNER = "/* Copyright (c) 2025 Vision AI Mind. All rights reserved. Unauthorized use prohibited. */";

export default defineConfig({
  base: "/",
  plugins: [react()],
  envPrefix: "VITE_",
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5176",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    ssr: false,
    chunkSizeWarningLimit: 1200,
    minify: "terser",
    // Hinweis: Source Maps in Prod vermeiden; bei Bedarf aktivieren: sourcemap: true (nicht empfohlen fuer Prod).
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        banner: COPYRIGHT_BANNER,
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
});
