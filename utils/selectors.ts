/**
 * DOM selector constants for X (x.com / twitter.com).
 * X's class names are obfuscated and unstable, so only data-testid is used.
 * Kept in one place so DOM changes on X's side only need to be tracked here.
 */

export const TWEET_ROOT_SELECTOR = 'article[data-testid="tweet"]';

export const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';

export const PHOTO_SELECTOR = 'div[data-testid="tweetPhoto"]';

export const VIDEO_COMPONENT_SELECTOR = 'div[data-testid="videoComponent"]';

export const VIDEO_PLAYER_SELECTOR = 'div[data-testid="videoPlayer"]';

/** Selector matching any media container that may be a folding target */
export const MEDIA_CONTAINER_SELECTOR = [
  PHOTO_SELECTOR,
  VIDEO_COMPONENT_SELECTOR,
  VIDEO_PLAYER_SELECTOR,
].join(", ");

export const PROCESSED_ATTR = "data-ixi-processed";
export const REVEALED_ATTR = "data-ixi-revealed";
export const MEDIA_KIND_ATTR = "data-ixi-kind";

export type MediaKind = "image" | "video";

/**
 * tweetPhoto is also used for video thumbnails, so we distinguish image
 * from video by checking whether a video element / videoComponent exists
 * inside the container itself, or under an ancestor videoPlayer.
 */
export function detectMediaKind(container: Element): MediaKind {
  if (container.matches(VIDEO_COMPONENT_SELECTOR)) {
    return "video";
  }

  if (container.matches(VIDEO_PLAYER_SELECTOR)) {
    return "video";
  }

  if (container.querySelector("video")) {
    return "video";
  }

  if (container.querySelector(VIDEO_COMPONENT_SELECTOR)) {
    return "video";
  }

  const videoPlayerAncestor = container.closest(VIDEO_PLAYER_SELECTOR);
  if (videoPlayerAncestor) {
    return "video";
  }

  return "image";
}
