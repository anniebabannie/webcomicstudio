import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    host: true, // Listen on all local IPs (allows custom domains via /etc/hosts)
    allowedHosts: true, // Allow any host in dev (needed for many custom domains)
  },
});
