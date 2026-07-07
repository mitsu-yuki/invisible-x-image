import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUTTON_CLASS, createMediaHider, HIDDEN_CLASS, OVERLAY_CLASS } from "./hider";
import {
  MEDIA_KIND_ATTR,
  PROCESSED_ATTR,
  REVEALED_ATTR,
  type MediaKind,
} from "../../utils/selectors";
import type { Settings } from "../../utils/settings";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { hideImages: true, hideVideos: true, ...overrides };
}

function query(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`element not found: ${selector}`);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("scanAndHide", () => {
  it("tweetPhoto にオーバーレイとボタンを挿入し data-ixi-processed を付与する", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    expect(photo.getAttribute(PROCESSED_ATTR)).toBe("true");
    expect(photo.getAttribute(MEDIA_KIND_ATTR)).toBe("image");
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(true);

    const overlay = photo.querySelector(`.${OVERLAY_CLASS}`);
    expect(overlay).not.toBeNull();
    const button = overlay?.querySelector(`.${BUTTON_CLASS}`);
    expect(button?.textContent).toBe("画像を表示");
  });

  it("二重に走査しても overlay は重複しない", () => {
    document.body.innerHTML = `<div data-testid="tweetPhoto"></div>`;
    const hider = createMediaHider(() => makeSettings());

    hider.scanAndHide(document.body);
    hider.scanAndHide(document.body);

    expect(document.querySelectorAll(`.${OVERLAY_CLASS}`)).toHaveLength(1);
  });

  it("videoPlayer > videoComponent の入れ子では最も内側だけが処理される", () => {
    document.body.innerHTML = `
      <div data-testid="videoPlayer">
        <div data-testid="videoComponent"></div>
      </div>
    `;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const player = query('[data-testid="videoPlayer"]');
    const component = query('[data-testid="videoComponent"]');

    expect(component.getAttribute(PROCESSED_ATTR)).toBe("true");
    expect(player.getAttribute(PROCESSED_ATTR)).toBeNull();
    expect(player.querySelector(`.${OVERLAY_CLASS}`)).toBe(
      component.querySelector(`.${OVERLAY_CLASS}`),
    );
  });

  it("祖先が処理済みの場合、後から追加された内側の要素は処理されない", () => {
    document.body.innerHTML = `<div data-testid="videoPlayer"></div>`;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const player = query('[data-testid="videoPlayer"]');
    const component = document.createElement("div");
    component.setAttribute("data-testid", "videoComponent");
    player.appendChild(component);

    hider.scanAndHide(component);

    expect(component.getAttribute(PROCESSED_ATTR)).toBeNull();
    expect(component.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
  });

  it("設定 OFF の種別は処理されない", () => {
    document.body.innerHTML = `<div data-testid="tweetPhoto"></div>`;
    const hider = createMediaHider(() => makeSettings({ hideImages: false }));
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    expect(photo.getAttribute(PROCESSED_ATTR)).toBe("true");
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(photo.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
  });

  it("動画プレースホルダー化時に video.pause() が呼ばれる", () => {
    document.body.innerHTML = `
      <div data-testid="videoComponent">
        <video></video>
      </div>
    `;
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    expect(pauseSpy).toHaveBeenCalled();
    pauseSpy.mockRestore();
  });
});

describe("ボタンクリック", () => {
  it("クリックで overlay が消え data-ixi-revealed が付与され、親へ伝播しない", () => {
    document.body.innerHTML = `<div data-testid="tweetPhoto"></div>`;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    const button = query(`.${BUTTON_CLASS}`) as HTMLButtonElement;

    const parentListener = vi.fn();
    document.body.addEventListener("click", parentListener);

    button.click();

    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(photo.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
    expect(photo.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(parentListener).not.toHaveBeenCalled();
  });
});

describe("handleToggle", () => {
  it("OFF で全解除、ON で revealed 済みも含め再度隠す", () => {
    document.body.innerHTML = `
      <div data-testid="tweetPhoto" id="p1"></div>
      <div data-testid="tweetPhoto" id="p2"></div>
    `;
    const settings = makeSettings();
    const hider = createMediaHider(() => settings);
    hider.scanAndHide(document.body);

    const p1 = query("#p1");
    const p2 = query("#p2");

    // p1 はユーザーが個別に表示済みとする
    hider.revealMedia(p1);
    expect(p1.getAttribute(REVEALED_ATTR)).toBe("true");

    const kind: MediaKind = "image";
    hider.handleToggle(kind, false);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();

    hider.handleToggle(kind, true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(p1.querySelector(`.${OVERLAY_CLASS}`)).not.toBeNull();
    expect(p2.querySelector(`.${OVERLAY_CLASS}`)).not.toBeNull();
  });
});
