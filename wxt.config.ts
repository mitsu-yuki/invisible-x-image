import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Invisible X Image",
    description: "x.com 上のポストに含まれる画像・動画をプレースホルダーに置き換え、任意のタイミングでのみ表示できるようにします。",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
  },
});
