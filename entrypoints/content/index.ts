import { createMediaHider } from "./hider";
import { getSettings, onSettingsChanged, type Settings } from "../../utils/settings";
import "./style.css";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_idle",
  main() {
    let settings: Settings = { hideImages: true, hideVideos: true };
    const hider = createMediaHider(() => settings);

    getSettings().then((initial) => {
      settings = initial;
      hider.scanAndHide(document.body);
      startObserver();
    });

    onSettingsChanged((next, changedKeys) => {
      const prev = settings;
      settings = next;

      if (changedKeys.hideImages && prev.hideImages !== next.hideImages) {
        hider.handleToggle("image", next.hideImages);
      }
      if (changedKeys.hideVideos && prev.hideVideos !== next.hideVideos) {
        hider.handleToggle("video", next.hideVideos);
      }
    });

    function startObserver() {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            hider.scanAndHide(node as Element);
          });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  },
});
