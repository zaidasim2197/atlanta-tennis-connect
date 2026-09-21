import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    resolve: { alias: { "react/jsx-dev-runtime": "react/jsx-runtime" } },
    server: {
      proxy: {
        "/api": {
          target: process.env["VITE_API_URL"] || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  },
  nitro: { preset: "vercel" },
  tanstackStart: { server: { entry: "server" } },
});
