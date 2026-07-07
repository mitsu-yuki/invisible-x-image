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

const EMPTY_SIZER_EXCLUDED_SELECTOR = "img, video, svg, iframe";

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

  // 空サイザー: テキストを持たず、img/video/svg/iframe も子孫に持たない要素。
  function isEmptySizer(el: Element): boolean {
    if ((el.textContent ?? "").trim() !== "") return false;
    return el.querySelector(EMPTY_SIZER_EXCLUDED_SELECTOR) === null;
  }

  // fold root への引き上げ判定で、親のある子が「登ってよい子」かどうか。
  function isFoldableChild(child: Element): boolean {
    if (child.matches(MEDIA_CONTAINER_SELECTOR)) return true;
    if (child.querySelector(MEDIA_CONTAINER_SELECTOR)) return true;
    return isEmptySizer(child);
  }

  // メディアコンテナから祖先方向に「メディアしか含まないラッパー」の最上位まで登る。
  function findFoldRoot(container: Element, post: Element): Element {
    let current: Element = container;

    while (true) {
      const parent = current.parentElement;
      if (!parent || parent === post) break;

      const canClimb = Array.from(parent.children).every((child) => isFoldableChild(child));
      if (!canClimb) break;

      current = parent;
    }

    return current;
  }

  // fold root 候補配下に「現在の設定で隠すべきでない」メディアが混在する場合は
  // 引き上げをやめ、container 自身を折りたたみ対象とする。
  function determineFoldTarget(container: Element, post: Element, settings: Settings): Element {
    const candidate = findFoldRoot(container, post);
    if (candidate === container) return candidate;

    const mediaInCandidate = collectMediaContainers(candidate);
    const hasUnhidable = mediaInCandidate.some((el) => {
      const kind = detectMediaKind(el);
      return kind === "image" ? !settings.hideImages : !settings.hideVideos;
    });

    return hasUnhidable ? container : candidate;
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

      affectedPosts.add(post);

      const foldTarget = determineFoldTarget(container, post, settings);
      // 画像グリッドなど複数コンテナが同一 fold root に集約される場合、
      // 既に別コンテナの処理で折りたたみ済みなら二重適用しない。
      if (foldTarget.classList.contains(HIDDEN_CLASS)) continue;

      hideContainer(foldTarget);
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

  function markRevealed(foldRoot: Element) {
    foldRoot.setAttribute(REVEALED_ATTR, "true");
    foldRoot.querySelectorAll(MEDIA_CONTAINER_SELECTOR).forEach((el) => el.setAttribute(REVEALED_ATTR, "true"));
  }

  function revealPost(post: Element) {
    for (const foldRoot of foldedContainersInPost(post)) {
      unhideContainer(foldRoot);
      markRevealed(foldRoot);
    }
    post.querySelector(`.${REVEAL_LINK_CLASS}`)?.remove();
  }

  // トグル切替時は影響ポストのメディア状態を一旦リセットし、現在の設定で
  // scanAndHide に再構築させる（fold root の組み替えが必要になるため）。
  function resetPostMedia(post: Element) {
    for (const foldRoot of foldedContainersInPost(post)) {
      unhideContainer(foldRoot);
      foldRoot.removeAttribute(REVEALED_ATTR);
    }
    post.querySelectorAll(MEDIA_CONTAINER_SELECTOR).forEach((el) => {
      el.removeAttribute(PROCESSED_ATTR);
      el.removeAttribute(REVEALED_ATTR);
    });
    post.querySelector(`.${REVEAL_LINK_CLASS}`)?.remove();
  }

  function handleToggle(kind: MediaKind, _enabled: boolean) {
    const affectedPosts = new Set<Element>();
    document.querySelectorAll(`[${MEDIA_KIND_ATTR}="${kind}"]`).forEach((el) => {
      const post = el.closest(TWEET_ROOT_SELECTOR);
      if (post) affectedPosts.add(post);
    });

    affectedPosts.forEach(resetPostMedia);
    scanAndHide(document.body);
  }

  return {
    collectMediaContainers,
    scanAndHide,
    revealPost,
    handleToggle,
  };
}

export type MediaHider = ReturnType<typeof createMediaHider>;
