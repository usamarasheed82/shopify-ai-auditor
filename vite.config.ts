import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals();

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the ℹ️ symbol or add the `LANG=en_US.UTF-8` environment variable.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig: UserConfig["server"] = undefined;

if (host === "localhost") {
  hmrConfig = {
    port: 64999,
    strictPort: true,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host,
    port: 443,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
});

function installGlobals() {
  // noop - Vite handles this
}
