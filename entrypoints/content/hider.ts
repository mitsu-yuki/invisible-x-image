import {
  MEDIA_CONTAINER_SELECTOR,
  MEDIA_KIND_ATTR,
  PROCESSED_ATTR,
  REVEALED_ATTR,
  detectMediaKind,
  type MediaKind,
} from "../../utils/selectors";
import type { Settings } from "../../utils/settings";

export const HIDDEN_CLASS = "ixi-hidden";
export const OVERLAY_CLASS = "ixi-overlay";
export const BUTTON_CLASS = "ixi-overlay-button";

/**
 * プレースホルダー化のロジック本体。現在の設定は毎回 getSettings() で
 * 取得するため、呼び出し側で設定が変わっても作り直す必要はない。
 */
export function createMediaHider(getSettings: () => Settings) {
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
    const settings = getSettings();
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

  return {
    collectMediaContainers,
    scanAndHide,
    applyPlaceholder,
    removePlaceholder,
    revealMedia,
    handleToggle,
  };
}

export type MediaHider = ReturnType<typeof createMediaHider>;
