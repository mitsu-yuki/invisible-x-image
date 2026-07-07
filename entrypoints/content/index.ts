import {
  MEDIA_CONTAINER_SELECTOR,
  MEDIA_KIND_ATTR,
  PROCESSED_ATTR,
  REVEALED_ATTR,
  detectMediaKind,
  type MediaKind,
} from "../../utils/selectors";
import { getSettings, onSettingsChanged, type Settings } from "../../utils/settings";
import "./style.css";

const HIDDEN_CLASS = "ixi-hidden";
const OVERLAY_CLASS = "ixi-overlay";
const BUTTON_CLASS = "ixi-overlay-button";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_idle",
  main() {
    let settings: Settings = { hideImages: true, hideVideos: true };

    getSettings().then((initial) => {
      settings = initial;
      scanAndHide(document.body);
      startObserver();
    });

    onSettingsChanged((next, changedKeys) => {
      const prev = settings;
      settings = next;

      if (changedKeys.hideImages && prev.hideImages !== next.hideImages) {
        handleToggle("image", next.hideImages);
      }
      if (changedKeys.hideVideos && prev.hideVideos !== next.hideVideos) {
        handleToggle("video", next.hideVideos);
      }
    });

    function startObserver() {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            scanAndHide(node as Element);
          });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    function collectMediaContainers(root: Element): Element[] {
      const candidates = new Set<Element>();

      if (root.matches(MEDIA_CONTAINER_SELECTOR)) {
        candidates.add(root);
      }
      root.querySelectorAll(MEDIA_CONTAINER_SELECTOR).forEach((el) => candidates.add(el));

      const all = Array.from(candidates);
      // 入れ子になった候補（videoPlayer > videoComponent など）は
      // 最も内側の要素だけを残し、二重にプレースホルダー化しない。
      return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
    }

    function scanAndHide(root: Element) {
      const containers = collectMediaContainers(root);

      for (const container of containers) {
        if (container.hasAttribute(PROCESSED_ATTR)) continue;
        // 祖先が別バッチで処理済みの場合（videoPlayer 処理後に内側の
        // videoComponent が追加されるケース）は祖先側に従い二重処理しない。
        if (container.parentElement?.closest(`[${PROCESSED_ATTR}]`)) continue;

        const kind = detectMediaKind(container);
        const shouldHide = kind === "image" ? settings.hideImages : settings.hideVideos;

        container.setAttribute(MEDIA_KIND_ATTR, kind);

        if (!shouldHide) {
          container.setAttribute(PROCESSED_ATTR, "true");
          continue;
        }

        applyPlaceholder(container, kind);
      }
    }

    function applyPlaceholder(container: Element, kind: MediaKind) {
      container.setAttribute(PROCESSED_ATTR, "true");
      container.setAttribute(MEDIA_KIND_ATTR, kind);

      const el = container as HTMLElement;
      if (getComputedStyle(el).position === "static") {
        el.style.position = "relative";
      }

      el.classList.add(HIDDEN_CLASS);

      for (const video of Array.from(el.querySelectorAll("video"))) {
        video.pause();
        video.muted = true;
      }
      el.addEventListener("play", handleVideoResume, true);

      const overlay = document.createElement("div");
      overlay.className = OVERLAY_CLASS;

      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.textContent = kind === "image" ? "画像を表示" : "動画を表示";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        revealMedia(container);
      });

      overlay.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      overlay.appendChild(button);
      el.appendChild(overlay);
    }

    function handleVideoResume(event: Event) {
      const container = (event.currentTarget as HTMLElement) ?? null;
      if (container?.classList.contains(HIDDEN_CLASS) && event.target instanceof HTMLVideoElement) {
        event.target.pause();
      }
    }

    function removePlaceholder(container: Element) {
      const el = container as HTMLElement;
      el.classList.remove(HIDDEN_CLASS);
      el.removeEventListener("play", handleVideoResume, true);

      const overlay = el.querySelector(`.${OVERLAY_CLASS}`);
      overlay?.remove();
    }

    function revealMedia(container: Element) {
      removePlaceholder(container);
      container.setAttribute(REVEALED_ATTR, "true");
    }

    function handleToggle(kind: MediaKind, enabled: boolean) {
      const elements = document.querySelectorAll(`[${MEDIA_KIND_ATTR}="${kind}"]`);

      if (enabled) {
        elements.forEach((el) => {
          el.removeAttribute(PROCESSED_ATTR);
          el.removeAttribute(REVEALED_ATTR);
        });
        scanAndHide(document.body);
      } else {
        elements.forEach((el) => removePlaceholder(el));
      }
    }
  },
});
