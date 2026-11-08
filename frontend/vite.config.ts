import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        target: "chrome106",
        // The frame's SDK 23 WebView rejects alpha hex colours, even on Chromium 106.
        // Preserve rgba() colours and older viewport fallbacks in production CSS.
        cssTarget: "chrome61"
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": {
                // target: "http://localhost:3000",
                target: "http://footypal:3000",
                changeOrigin: true
            }
        }
    }
});
