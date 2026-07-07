import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMediaHider, HIDDEN_CLASS, REVEAL_LINK_CLASS } from "./hider";
import { MEDIA_KIND_ATTR, PROCESSED_ATTR, REVEALED_ATTR, type MediaKind } from "../../utils/selectors";
import type { Settings } from "../../utils/settings";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { hideImages: true, hideVideos: true, ...overrides };
}

function query(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`element not found: ${selector}`);
  return el;
}

function queryAll(selector: string): Element[] {
  return Array.from(document.querySelectorAll(selector));
}

const I18N_MESSAGES: Record<string, string> = {
  showMedia: "Show media",
};

beforeEach(() => {
  document.body.innerHTML = "";
  // fakeBrowser's i18n.getMessage throws "not implemented" by default, so
  // stub it here with the en messages used across these tests.
  vi.spyOn(browser.i18n, "getMessage").mockImplementation(
    (key: string) => I18N_MESSAGES[key] ?? "",
  );
});

describe("scanAndHide", () => {
  it("folds a tweetPhoto inside a post and inserts one 'Show media' link right after tweetText", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    expect(photo.getAttribute(PROCESSED_ATTR)).toBe("true");
    expect(photo.getAttribute(MEDIA_KIND_ATTR)).toBe("image");
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(true);

    const links = queryAll(`.${REVEAL_LINK_CLASS}`);
    expect(links).toHaveLength(1);

    const tweetText = query('[data-testid="tweetText"]');
    expect(tweetText.nextElementSibling).toBe(links[0]);
  });

  it("does not process media outside of a post (article)", () => {
    document.body.innerHTML = `<div data-testid="tweetPhoto"></div>`;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    expect(photo.hasAttribute(PROCESSED_ATTR)).toBe(false);
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);
  });

  it("inserts the link where the media was for posts with no post text", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    const link = query(`.${REVEAL_LINK_CLASS}`);
    expect(photo.previousElementSibling).toBe(link);
  });

  it("shows only one link for a mix of 2 images + 1 video; clicking reveals all of them, removes the link, and marks them revealed", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto" id="p1"></div>
        <div data-testid="tweetPhoto" id="p2"></div>
        <div data-testid="videoComponent" id="v1"><video></video></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    expect(queryAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);

    const p1 = query("#p1");
    const p2 = query("#p2");
    const v1 = query("#v1");
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(true);

    const link = query(`.${REVEAL_LINK_CLASS}`) as HTMLAnchorElement;
    link.click();

    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p1.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(p2.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(v1.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);
  });

  it("does not let the link click propagate to parent elements", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const parentListener = vi.fn();
    document.body.addEventListener("click", parentListener);

    const link = query(`.${REVEAL_LINK_CLASS}`) as HTMLAnchorElement;
    link.click();

    expect(parentListener).not.toHaveBeenCalled();
  });

  it("does not fold images when hideImages is false (link still appears if only video is folded)", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto" id="p1"></div>
        <div data-testid="videoComponent" id="v1"><video></video></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings({ hideImages: false }));
    hider.scanAndHide(document.body);

    const p1 = query("#p1");
    const v1 = query("#v1");
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(queryAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });

  it("for nested videoPlayer > videoComponent, detection uses the innermost element but folding is raised to videoPlayer (the fold root)", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="videoPlayer">
          <div data-testid="videoComponent"></div>
        </div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const player = query('[data-testid="videoPlayer"]');
    const component = query('[data-testid="videoComponent"]');

    expect(component.getAttribute(PROCESSED_ATTR)).toBe("true");
    expect(player.getAttribute(PROCESSED_ATTR)).toBeNull();
    expect(player.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(component.classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it("does not process an inner element added later if its ancestor was already processed", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="videoPlayer"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const player = query('[data-testid="videoPlayer"]');
    const component = document.createElement("div");
    component.setAttribute("data-testid", "videoComponent");
    player.appendChild(component);

    hider.scanAndHide(component);

    expect(component.getAttribute(PROCESSED_ATTR)).toBeNull();
    expect(component.classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it("does not duplicate the link when scanning twice", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());

    hider.scanAndHide(document.body);
    hider.scanAndHide(document.body);

    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });

  it("localizes the reveal link text via browser.i18n.getMessage", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const getMessageSpy = vi.spyOn(browser.i18n, "getMessage");
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    expect(getMessageSpy).toHaveBeenCalledWith("showMedia");
    const link = query(`.${REVEAL_LINK_CLASS}`) as HTMLAnchorElement;
    expect(link.textContent).toBe("Show media");
  });

  it("calls video.pause() when a video is folded", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="videoComponent">
          <video></video>
        </div>
      </article>
    `;
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    expect(pauseSpy).toHaveBeenCalled();
    pauseSpy.mockRestore();
  });
});

describe("raising to the fold root", () => {
  it("folds the whole wrapper (sizer included) for a wrapper with a sizer (empty div) + content div sibling structure", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div class="wrapper">
          <div class="sizer"></div>
          <div class="content">
            <div data-testid="tweetPhoto"></div>
          </div>
        </div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const wrapper = query(".wrapper");
    const sizer = query(".sizer");
    const photo = query('[data-testid="tweetPhoto"]');

    // HIDDEN_CLASS is applied to the fold root (wrapper), hiding the sizer too
    expect(wrapper.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(wrapper.contains(sizer)).toBe(true);
  });

  it("folds a single fold root and shows a single link for 2 images in a grid (shared wrapper); clicking reveals both", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div class="grid">
          <div data-testid="tweetPhoto" id="p1"></div>
          <div data-testid="tweetPhoto" id="p2"></div>
        </div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const grid = query(".grid");
    const p1 = query("#p1");
    const p2 = query("#p2");

    expect(grid.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(queryAll(`.${HIDDEN_CLASS}`)).toHaveLength(1);
    expect(queryAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);

    const link = query(`.${REVEAL_LINK_CLASS}`) as HTMLAnchorElement;
    link.click();

    expect(grid.classList.contains(HIDDEN_CLASS)).toBe(false);
    const post = query('article[data-testid="tweet"]');
    expect(post.querySelectorAll(`.${HIDDEN_CLASS}`)).toHaveLength(0);
  });

  it("does not raise to the fold root when an image and a video share a wrapper with hideImages: true / hideVideos: false — only the image container is folded", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div class="mixedWrapper">
          <div data-testid="tweetPhoto" id="p1"></div>
          <div data-testid="videoComponent" id="v1"><video></video></div>
        </div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings({ hideVideos: false }));
    hider.scanAndHide(document.body);

    const wrapper = query(".mixedWrapper");
    const p1 = query("#p1");
    const v1 = query("#v1");

    expect(wrapper.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it("does not climb up to a level containing text such as a username (e.g. directly under article)", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div class="row">
          <span class="username">User Name</span>
          <div data-testid="tweetPhoto"></div>
        </div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const row = query(".row");
    const photo = query('[data-testid="tweetPhoto"]');

    expect(row.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe("handleToggle", () => {
  it("expands everything and removes the link when turned OFF; re-folds (including already-revealed items) and re-inserts the link when turned ON", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto" id="p1"></div>
        <div data-testid="tweetPhoto" id="p2"></div>
      </article>
    `;
    // The real caller (content/index.ts) updates its held settings before
    // calling handleToggle, so update settings here first too, as it would.
    const settings = makeSettings();
    const hider = createMediaHider(() => settings);
    hider.scanAndHide(document.body);

    const post = query('article[data-testid="tweet"]');
    const p1 = query("#p1");
    const p2 = query("#p2");
    const kind: MediaKind = "image";

    // Simulate p1 having already been revealed individually via the link click
    hider.revealPost(post);
    expect(p1.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);

    // Fold again first, then check the OFF behavior
    settings.hideImages = true;
    hider.handleToggle(kind, true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);

    settings.hideImages = false;
    hider.handleToggle(kind, false);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);

    settings.hideImages = true;
    hider.handleToggle(kind, true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(p2.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });

  it("in a post with mixed images and video, turning only images OFF expands the images while the video stays folded; the link remains", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Post text</div>
        <div data-testid="tweetPhoto" id="p1"></div>
        <div data-testid="videoComponent" id="v1"><video></video></div>
      </article>
    `;
    const settings = makeSettings();
    const hider = createMediaHider(() => settings);
    hider.scanAndHide(document.body);

    const p1 = query("#p1");
    const v1 = query("#v1");
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(true);

    settings.hideImages = false;
    hider.handleToggle("image", false);

    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(v1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });
});
