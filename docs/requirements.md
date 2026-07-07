# invisible-x-image Requirements

[日本語](./requirements-ja.md)

A Google Chrome extension that replaces images and videos on x.com (formerly Twitter) with placeholders.

## 1. Background and purpose

The x.com timeline frequently shows posts with images and video. To prevent unwanted media from entering the user's view, this extension replaces media with a placeholder that can be revealed with a single click.

## 2. Functional requirements

### 2.1 Media folding

Media is hidden using a folding UI similar to the "Show more" used for long post text.

- **FR-1**: Images contained within a post (`article[data-testid="tweet"]`) must be folded (the media area is collapsed and hidden).
- **FR-2**: Videos (including GIFs) contained within a post must be folded the same way.
- **FR-3**: A post with folded media must show exactly **one** "Show media" link text at the **bottom-right of the post text**. The label is fixed as "Show media" so it's distinguishable from the long-text fold ("Show more"). For media-only posts with no post text (`div[data-testid="tweetText"]`), the link is shown right-aligned where the media used to be.
- **FR-4**: Clicking the link must **directly reveal all of that post's folded media** (a single click, with no intermediate state such as a placeholder). The link disappears after revealing. Reloading the page may fold the media again.
- **FR-5**: While folded, the media area's height must be collapsed so the post displays compactly (an intentional layout reduction). The original layout must be restored when expanded.
- **FR-6**: Clicking the link must not trigger parent element events such as navigating to the post detail page (`stopPropagation` / `preventDefault`).
- **FR-7**: Folded videos must stop playback (`video.pause()` + `muted`) so no audio plays. Resuming playback after expansion is left to the user.

### 2.2 Scope

- **FR-8**: The extension targets all of x.com, but **only folds media inside a post** (`article[data-testid="tweet"]`):
  - Home timeline ("For you" / "Following")
  - Post detail pages (including replies)
  - Profile page timelines
  - Search results, trends, lists, bookmarks, notifications
  - Media inside quoted posts (folded together with the parent post's link, since it lives in the same `article`)
- **FR-9**: Must work on both the `https://x.com/*` and `https://twitter.com/*` domains.
- **Out of scope**: Media that appears standalone outside of a post (e.g. the grid on a profile's "Media" tab, where the intent to view media is clear so it isn't hidden), user avatars, banner images, emoji, link card (OGP) thumbnails, and media in DMs.

### 2.3 Following dynamic content

- **FR-10**: X is a virtual-scrolling SPA, and posts are added to and reused within the DOM dynamically. A `MutationObserver` (on `document.body`, with `childList` + `subtree`) must watch for added nodes and immediately turn new media into a placeholder.
- **FR-11**: Must keep working after in-page navigation (SPA navigation via `pushState`). Because the observer watches the entire body, no special navigation-detection logic is needed, but nothing may be missed even when navigation replaces the DOM wholesale.
- **FR-12**: Media already present at initial load (when the content script runs) must also be scanned and processed.
- **FR-13**: The same element must never be processed twice. Processed elements are marked with a `data-ixi-processed` attribute for this check.

### 2.4 Settings (popup UI)

- **FR-14**: Clicking the toolbar extension icon must show a popup.
- **FR-15**: The popup must provide two toggles (checkboxes): "Hide images" and "Hide videos". The UI is in English.
- **FR-16**: Settings must be stored in `chrome.storage.sync`. Keys and defaults:

  ```ts
  interface Settings {
    hideImages: boolean; // default true
    hideVideos: boolean; // default true
  }
  ```

- **FR-17**: Setting changes must take effect **immediately, without a reload**. The content script subscribes to `chrome.storage.onChanged`:
  - When a category is turned OFF → fully expand the folded media of that kind (and remove the link too, if no folding remains on that post)
  - When a category is turned ON → rescan the page and fold again (including media that had been manually revealed)
- When a post has a mix of images and videos, each kind is folded according to its own `hideImages` / `hideVideos` setting. If the post has at least one folded item, a single link is shown, and clicking it expands everything folded in that post.

## 3. DOM selector specification

X's class names are obfuscated and unstable, so selectors must rely **only on `data-testid` attributes**. The root of a post is `article[data-testid="tweet"]`.

| Target | Selector | Notes |
|---|---|---|
| Post | `article[data-testid="tweet"]` | The grouping unit for folding. Media outside this is out of scope |
| Post text | `div[data-testid="tweetText"]` | Reference point for inserting the "Show media" link |
| Image | `div[data-testid="tweetPhoto"]` | Container for an image in a post. Present once per image even in multi-image layouts |
| Video | `div[data-testid="videoComponent"]` | Container for the video/GIF player |
| Video (auxiliary) | `div[data-testid="videoPlayer"]` | May exist outside of `videoComponent` |

Notes:

- `tweetPhoto` is **also used for video thumbnails**. If a `video` element or `videoComponent` exists inside the container (or under an ancestor `videoPlayer`), it must be treated as "video" and follow the `hideVideos` setting.
- Media with the same `data-testid` appearing outside `article[data-testid="tweet"]` (e.g. the grid on a profile's media tab) must not be processed.
- Selectors must be centralized in a single constants module so they're easy to keep in sync with changes to X's DOM.

## 4. Folding specification

### Folding

- A CSS class is applied to the target media container to collapse the whole area with `display: none !important` (the intent is to shrink the height and keep the post compact).
- **Raising the fold target (fold root)**: X's media areas are wrapped in a wrapper that includes an empty sizer div (using `padding-bottom`) to preserve aspect ratio; hiding only the innermost media container would leave that blank area behind. So, starting from the media container, walk up through ancestor "wrapper containing only media" elements to the topmost one (the fold root), and fold that instead:
  - Keep climbing to the parent as long as **every child** of that parent is either "an element containing a media container" or "an empty sizer (an element with no text and no img/video/svg/iframe descendants)"
  - Never reach the post (`article`) itself. Stop and fold the current element as soon as a parent is found that doesn't meet the condition (i.e. one containing post text, a username, etc.)
  - Multiple media items (e.g. an image grid) may share the same fold root (folding one element hides all of them)
  - If the fold root candidate contains media of a "kind that shouldn't be hidden" (e.g. a post with both images and videos where only one setting is ON), don't raise the target — fold the individual media containers instead (leaving some blank space is acceptable)
- Folding is grouped per post (`article[data-testid="tweet"]`) and tracked via container attributes:
  - `data-ixi-processed`: already evaluated (prevents double processing)
  - `data-ixi-kind`: `image` / `video`
  - `data-ixi-revealed`: already revealed (not re-folded on rescan; reset and re-folded when the setting goes OFF→ON)

### The "Show media" link

- One element per post, inserted only into posts with at least one folded media item.
- Insertion point: placed right-aligned (`display: block; text-align: right`) immediately after the post text (`div[data-testid="tweetText"]`), so it appears at the "bottom-right of the post text". For posts with no post text, it's placed the same way immediately before the first folded container.
- Style: a text link in X's link color (`#1d9bf0`), underlined on hover, `cursor: pointer`.
- On click, calls `stopPropagation` / `preventDefault`, reveals all folded media in that post, and removes the link itself.
- Must not be inserted twice when a post is rescanned (the link element also carries an identifying class/attribute for this check).

## 5. Non-functional requirements

- **NFR-1**: Must comply with Manifest V3.
- **NFR-2**: Permissions must be minimal: `storage` only. Host permissions: `https://x.com/*`, `https://twitter.com/*`.
- **NFR-3**: No remote code, no external communication.
- **NFR-4**: `MutationObserver` callbacks must stay lightweight (avoid a full-page `querySelectorAll` on every mutation; scan only under the added nodes. Batched full-page scans via `requestAnimationFrame` / idle debouncing are also acceptable if the alternative becomes overly complex).
- **NFR-5**: TypeScript type checking (equivalent to `tsc --noEmit`) and the build must pass with no errors.

## 6. Technical stack

- Framework: **WXT** (Manifest V3, manifest auto-generation)
- Language: TypeScript (no UI framework; the popup is plain HTML + TS)
- Package management: pnpm (Node, pnpm, and claude are managed via mise, with versions pinned in `mise.toml`)

### Directory structure

```
├── docs/
│   ├── requirements.md    # This document
│   └── requirements-ja.md # Japanese version
├── wxt.config.ts          # manifest definition
├── vitest.config.ts       # Test config (WxtVitest + happy-dom)
├── entrypoints/
│   ├── content/
│   │   ├── index.ts       # Content script entry point (loads settings, wires up the observer)
│   │   ├── hider.ts       # Core placeholder logic (verified in *.test.ts)
│   │   └── style.css      # Placeholder styles
│   └── popup/
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── selectors.ts       # DOM selector constants
│   └── settings.ts        # Settings type, read/write, change subscription
├── package.json
├── README.md              # Build and install instructions (English)
└── README-ja.md           # Build and install instructions (Japanese)
```

### Manifest requirements

- `name`: "Invisible X Image"
- `description`: an English description of the extension's functionality
- `default_locale` is not required (the popup's text can be written directly)
- content script: `matches: ["https://x.com/*", "https://twitter.com/*"]`, `run_at: "document_idle"`

## 7. Acceptance criteria

1. `pnpm run build` succeeds and produces a loadable extension under `.output/chrome-mv3/`.
2. `pnpm run compile` (tsc type check) passes with no errors.
3. `pnpm run test` (vitest) passes.
4. On the x.com home timeline, posts with media are folded and show a "Show media" link at the bottom-right of the post text, and clicking it reveals that post's media in one click (manual verification). The grid on a profile's "Media" tab is not folded (manual verification).
5. Toggling the popup checkboxes takes effect on the open tab without a reload (manual verification).
6. Folding works for posts loaded by scrolling and on pages reached via SPA navigation (manual verification).
