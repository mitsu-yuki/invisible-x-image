# Invisible X Image

[日本語](./README-ja.md)

A Chrome extension (Manifest V3) that hides images and videos in posts on x.com (formerly Twitter) using a folding UI similar to the "Show more" for long text. Clicking the "Show media" link that appears at the bottom-right of a folded post's text reveals all of that post's media in one click.

See [docs/requirements.md](./docs/requirements.md) for the full specification.

## Development environment

- Node.js is managed via [mise](https://mise.jdx.dev/). Follow the `mise.toml` in the repository root and set up with:

  ```sh
  mise install
  ```

  With mise activated, the `pnpm` commands below can be run as-is.

- Install dependencies:

  ```sh
  pnpm install
  ```

  (`postinstall` runs `wxt prepare`, which generates type information into `.wxt/`)

## Build steps

Type check:

```sh
pnpm run compile
```

Unit tests (vitest):

```sh
pnpm run test
```

Production build:

```sh
pnpm run build
```

On success, `manifest.json`, the content script, and the popup are generated under `.output/chrome-mv3/`.

Generate a distribution zip (e.g. for attaching to a GitHub Release; produces `.output/invisible-x-image-<version>-chrome.zip`):

```sh
pnpm run zip
```

For auto-reload during development (launches Chrome automatically):

```sh
pnpm run dev
```

## Loading into Chrome

1. Run `pnpm run build` above to generate `.output/chrome-mv3/`.
2. Open `chrome://extensions` in Chrome.
3. Turn on "Developer mode" in the top right.
4. Click "Load unpacked" and select the `.output/chrome-mv3/` directory.
5. Confirm "Invisible X Image" appears in the extensions list.

After changing code, run `pnpm run build` again and click "Reload" for the extension on `chrome://extensions`.

## Manual verification steps

1. Open the home timeline at https://x.com (or https://twitter.com).
2. Confirm that the media area of posts with images/videos is folded, and a "Show media" link appears at the bottom-right of the post text (only one link even for posts with mixed images and videos).
3. Confirm that clicking the link reveals all of that post's folded media in one click and the link itself disappears (other posts' folding is left intact).
4. Confirm that reloading the page folds the media again.
5. Confirm that while a post with video is folded, the video does not play and no audio is heard.
6. Confirm that folding keeps working as you scroll and new posts load into the timeline.
7. Confirm that folding works after navigating to other pages within the SPA — post detail pages, profile pages, search results, lists, bookmarks, notifications, etc. Also confirm that the grid on a profile's "Media" tab (standalone media outside of posts) is not folded.
8. Click the extension icon in the toolbar to open the popup and confirm the "Hide images" / "Hide videos" checkboxes reflect the current settings.
9. Turn a checkbox off in the popup and confirm the corresponding folding on the open tab expands immediately without a reload, and the link disappears. Turn it back on and confirm folding is reapplied — including to media that had been manually revealed — and the link reappears.

## Directory structure

```
├── docs/
│   ├── requirements.md    # Requirements document (English)
│   └── requirements-ja.md # Requirements document (Japanese)
├── wxt.config.ts          # manifest definition
├── vitest.config.ts       # Test config (WxtVitest + happy-dom)
├── entrypoints/
│   ├── content/
│   │   ├── index.ts       # Content script entry point (loads settings, wires up the observer)
│   │   ├── hider.ts       # Core folding logic
│   │   ├── hider.test.ts
│   │   └── style.css      # Styles for folding and the "Show media" link
│   └── popup/
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── selectors.ts       # DOM selector constants
│   ├── selectors.test.ts
│   ├── settings.ts        # Settings type, read/write, change subscription
│   └── settings.test.ts
├── package.json
├── pnpm-workspace.yaml    # pnpm config (allows dependency build scripts)
├── README.md              # English
└── README-ja.md           # Japanese
```

## Permissions

- `storage` (used only to persist settings)
- host permissions: `https://x.com/*`, `https://twitter.com/*`

No external communication and no remote code loading of any kind.
