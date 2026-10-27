import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    // Berkas hasil build ditanam ke dalam binari Go, jadi jaga agar ringkas.
    target: "es2022",
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
});
