import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Invisible X Image",
    description: "__MSG_extDescription__",
    default_locale: "en",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
  },
});
