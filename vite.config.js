import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const COPYRIGHT_BANNER = "/* Copyright (c) 2025 Vision AI Mind. All rights reserved. Unauthorized use prohibited. */";

// Production obfuscation settings
const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false, // Enable in production if needed
  disableConsoleOutput: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

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
    // Proxy für lokales Backend (server/index.js auf Port 5176)
    // Starte zuerst: node server/index.js
    proxy: {
      "/api": {
        target: "http://localhost:5176",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] Backend nicht erreichbar:', err.message);
          });
        },
      },
    },
  },
  build: {
    ssr: false,
    chunkSizeWarningLimit: 1200,
    minify: "terser",
    // SECURITY: No source maps in production
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 3,
        pure_funcs: ["console.log", "console.info", "console.debug"],
        dead_code: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        toplevel: true,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/, // Only mangle properties starting with underscore
        },
      },
      format: {
        comments: false,
        ascii_only: true,
      },
    },
    rollupOptions: {
      output: {
        banner: COPYRIGHT_BANNER,
        // Obscure chunk names in production
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash].[ext]",
        // Code-Splitting für bessere Performance
        manualChunks: {
          // React Core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts & Visualisierung
          'vendor-charts': ['recharts'],
          // Firebase Services
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // State Management & Utils
          'vendor-utils': ['zustand', 'axios'],
          // Icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
});
