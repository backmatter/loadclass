import { defineConfig } from "vite-plus";
import { fileURLToPath, URL } from "node:url";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "#": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [viteReact()],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
  },
});
