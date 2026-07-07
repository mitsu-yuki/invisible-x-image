import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Invisible X Image",
    description:
      "Collapses images and videos in posts on x.com, with a 'Show media' link to reveal them per post.",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
  },
});
