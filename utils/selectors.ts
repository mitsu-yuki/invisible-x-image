/**
 * X (x.com / twitter.com) の DOM セレクタ定数。
 * X のクラス名は難読化され不安定なため data-testid のみを使用する。
 * X 側の DOM 変更時はここだけを追従すればよいように一元管理する。
 */

export const TWEET_ROOT_SELECTOR = 'article[data-testid="tweet"]';

export const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';

export const PHOTO_SELECTOR = 'div[data-testid="tweetPhoto"]';

export const VIDEO_COMPONENT_SELECTOR = 'div[data-testid="videoComponent"]';

export const VIDEO_PLAYER_SELECTOR = 'div[data-testid="videoPlayer"]';

/** 折りたたみの対象となりうるメディアコンテナ全般のセレクタ */
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
 * tweetPhoto は動画のサムネイルにも使われるため、コンテナ自身または
 * videoPlayer 祖先の配下に video 要素 / videoComponent が存在するかどうかで
 * 画像か動画かを判別する。
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
