import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const COPYRIGHT_BANNER = "/* Copyright (c) 2025 Vision AI Mind. All rights reserved. Unauthorized use prohibited. */";

export default defineConfig({
  base: "/",
  plugins: [react()],
  envPrefix: "VITE_",
  // Vite 7 Bug fix: Exclude index.html from import analysis
  optimizeDeps: {
    entries: ['src/main.jsx'],
    exclude: ['index.html'],
  },
  server: {
    warmup: {
      clientFiles: ['./src/**/*.jsx', './src/**/*.tsx', './src/**/*.js', './src/**/*.ts'],
    },
    fs: {
      // Erlaube Zugriff auf das gesamte Projektverzeichnis
      allow: ['.'],
      strict: false,
    },
    // Proxy nur aktiv wenn dev:api läuft (Port 5176)
    // Für lokale Tests ohne API: auskommentieren oder vercel dev nutzen
    proxy: {
      "/api": {
        target: "http://localhost:5176",
        changeOrigin: true,
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
