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
 * Core folding logic. The current settings are fetched via getSettings() on
 * every call, so callers don't need to recreate this when settings change.
 */
export function createMediaHider(getSettings: () => Settings) {
  function collectMediaContainers(root: Element): Element[] {
    const candidates = new Set<Element>();

    if (root.matches(MEDIA_CONTAINER_SELECTOR)) {
      candidates.add(root);
    }
    root.querySelectorAll(MEDIA_CONTAINER_SELECTOR).forEach((el) => candidates.add(el));

    const all = Array.from(candidates);
    // For nested candidates (e.g. videoPlayer > videoComponent), keep only
    // the innermost element so we don't fold the same media twice.
    return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
  }

  // Empty sizer: an element with no text and no img/video/svg/iframe descendants.
  function isEmptySizer(el: Element): boolean {
    if ((el.textContent ?? "").trim() !== "") return false;
    return el.querySelector(EMPTY_SIZER_EXCLUDED_SELECTOR) === null;
  }

  // When deciding whether to raise the fold target, is this child of the
  // parent one we're allowed to climb past?
  function isFoldableChild(child: Element): boolean {
    if (child.matches(MEDIA_CONTAINER_SELECTOR)) return true;
    if (child.querySelector(MEDIA_CONTAINER_SELECTOR)) return true;
    return isEmptySizer(child);
  }

  // From a media container, climb up through ancestor "media-only wrapper"
  // elements to the topmost one.
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

  // If the fold root candidate contains media that shouldn't be hidden under
  // the current settings, don't raise the target — fold container itself.
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
      // If an ancestor was already processed in a different batch (e.g. a
      // videoComponent added inside an already-processed videoPlayer),
      // defer to the ancestor and skip processing this one twice.
      if (container.parentElement?.closest(`[${PROCESSED_ATTR}]`)) continue;

      // Media outside of a post (article[data-testid="tweet"]) is out of scope.
      const post = container.closest(TWEET_ROOT_SELECTOR);
      if (!post) continue;

      const kind = detectMediaKind(container);
      container.setAttribute(MEDIA_KIND_ATTR, kind);
      container.setAttribute(PROCESSED_ATTR, "true");

      const shouldHide = kind === "image" ? settings.hideImages : settings.hideVideos;
      if (!shouldHide) continue;

      affectedPosts.add(post);

      const foldTarget = determineFoldTarget(container, post, settings);
      // When multiple containers (e.g. an image grid) share the same fold
      // root, don't apply it twice if another container already folded it.
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
    link.textContent = browser.i18n.getMessage("showMedia");
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

  // On toggle, reset the affected posts' media state first and let
  // scanAndHide rebuild it under the current settings (the fold root may
  // need to be recomputed).
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
