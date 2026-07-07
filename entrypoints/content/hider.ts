import {
  MEDIA_CONTAINER_SELECTOR,
  MEDIA_KIND_ATTR,
  PROCESSED_ATTR,
  REVEALED_ATTR,
  TWEET_ROOT_SELECTOR,
  TWEET_TEXT_SELECTOR,
  detectMediaKind,
  type MediaKind,
} from "../../utils/selectors";
import type { Settings } from "../../utils/settings";

export const HIDDEN_CLASS = "ixi-hidden";
export const REVEAL_LINK_CLASS = "ixi-reveal-link";

/**
 * フォールディング(折りたたみ)ロジック本体。現在の設定は毎回 getSettings() で
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
    // 最も内側の要素だけを残し、二重に折りたたまない。
    return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
  }

  function scanAndHide(root: Element) {
    const settings = getSettings();
    const containers = collectMediaContainers(root);
    const affectedPosts = new Set<Element>();

    for (const container of containers) {
      if (container.hasAttribute(PROCESSED_ATTR)) continue;
      // 祖先が別バッチで処理済みの場合（videoPlayer 処理後に内側の
      // videoComponent が追加されるケース）は祖先側に従い二重処理しない。
      if (container.parentElement?.closest(`[${PROCESSED_ATTR}]`)) continue;

      // ポスト（article[data-testid="tweet"]）の外に現れるメディアは対象外。
      const post = container.closest(TWEET_ROOT_SELECTOR);
      if (!post) continue;

      const kind = detectMediaKind(container);
      container.setAttribute(MEDIA_KIND_ATTR, kind);
      container.setAttribute(PROCESSED_ATTR, "true");

      const shouldHide = kind === "image" ? settings.hideImages : settings.hideVideos;
      if (!shouldHide) continue;

      hideContainer(container);
      affectedPosts.add(post);
    }

    for (const post of affectedPosts) {
      ensureRevealLink(post);
    }
  }

  function hideContainer(container: Element) {
    const el = container as HTMLElement;
    el.classList.add(HIDDEN_CLASS);

    for (const video of Array.from(el.querySelectorAll("video"))) {
      video.pause();
      video.muted = true;
    }
    el.addEventListener("play", handleVideoResume, true);
  }

  function unhideContainer(container: Element) {
    const el = container as HTMLElement;
    el.classList.remove(HIDDEN_CLASS);
    el.removeEventListener("play", handleVideoResume, true);
  }

  function handleVideoResume(event: Event) {
    const container = (event.currentTarget as HTMLElement) ?? null;
    if (container?.classList.contains(HIDDEN_CLASS) && event.target instanceof HTMLVideoElement) {
      event.target.pause();
    }
  }

  function foldedContainersInPost(post: Element): Element[] {
    return Array.from(post.querySelectorAll(`.${HIDDEN_CLASS}`));
  }

  function ensureRevealLink(post: Element) {
    if (post.querySelector(`.${REVEAL_LINK_CLASS}`)) return;
    const folded = foldedContainersInPost(post);
    if (folded.length === 0) return;

    const link = createRevealLink(post);
    const tweetText = post.querySelector(TWEET_TEXT_SELECTOR);

    if (tweetText) {
      tweetText.insertAdjacentElement("afterend", link);
      return;
    }

    const firstFolded = folded[0];
    firstFolded.parentElement?.insertBefore(link, firstFolded);
  }

  function createRevealLink(post: Element): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = "#";
    link.className = REVEAL_LINK_CLASS;
    link.textContent = "メディアを表示";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealPost(post);
    });
    return link;
  }

  function revealPost(post: Element) {
    for (const container of foldedContainersInPost(post)) {
      unhideContainer(container);
      container.setAttribute(REVEALED_ATTR, "true");
    }
    post.querySelector(`.${REVEAL_LINK_CLASS}`)?.remove();
  }

  function handleToggle(kind: MediaKind, enabled: boolean) {
    const elements = document.querySelectorAll(`[${MEDIA_KIND_ATTR}="${kind}"]`);
    const affectedPosts = new Set<Element>();

    elements.forEach((el) => {
      const post = el.closest(TWEET_ROOT_SELECTOR);
      if (post) affectedPosts.add(post);

      if (enabled) {
        el.removeAttribute(PROCESSED_ATTR);
        el.removeAttribute(REVEALED_ATTR);
      } else if (el.classList.contains(HIDDEN_CLASS)) {
        unhideContainer(el);
      }
    });

    if (enabled) {
      // 再折りたたみ時にリンクを重複させないよう、対象ポストの既存リンクは
      // 一旦取り除いてから再走査する。
      affectedPosts.forEach((post) => post.querySelector(`.${REVEAL_LINK_CLASS}`)?.remove());
      scanAndHide(document.body);
    } else {
      affectedPosts.forEach((post) => {
        if (foldedContainersInPost(post).length === 0) {
          post.querySelector(`.${REVEAL_LINK_CLASS}`)?.remove();
        }
      });
    }
  }

  return {
    collectMediaContainers,
    scanAndHide,
    revealPost,
    handleToggle,
  };
}

export type MediaHider = ReturnType<typeof createMediaHider>;
