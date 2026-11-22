import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/";
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        injectRegister: null,
        includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          id: base,
          name: "MyHours: daily routine planner",
          short_name: "MyHours",
          description: "Daily routine planner, study tools and a private knowledge workspace.",
          theme_color: "#101c24",
          background_color: "#101c24",
          display: "standalone",
          scope: base,
          start_url: base,
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          globPatterns: ["**/*.{js,mjs,css,html,png,svg,woff2}"],
          cleanupOutdatedCaches: true,
          runtimeCaching: [],
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      setupFiles: ["tests/setup.ts"],
    },
  };
});
