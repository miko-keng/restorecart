import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "ag-grid-community",
      "ag-grid-react",
      "@bryntum/schedulerpro-react",
      "qrcode",
    ],
  },
  build: { outDir: "dist" },
  server: {
    host: "127.0.0.1",
    hmr: { port: Number(process.env.RESTORECART_HMR_PORT || 24679) },
  },
});
