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

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("scanAndHide", () => {
  it("ポスト内の tweetPhoto を折りたたみ、tweetText 直後に「メディアを表示」リンクを1つ挿入する", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
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

  it("ポスト(article)外のメディアは処理されない", () => {
    document.body.innerHTML = `<div data-testid="tweetPhoto"></div>`;
    const hider = createMediaHider(() => makeSettings());
    hider.scanAndHide(document.body);

    const photo = query('[data-testid="tweetPhoto"]');
    expect(photo.hasAttribute(PROCESSED_ATTR)).toBe(false);
    expect(photo.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);
  });

  it("本文がないポストではメディアがあった位置にリンクが入る", () => {
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

  it("画像2枚+動画1つが混在してもリンクは1つ。クリックで全部展開されリンクが消え revealed が付く", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
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

  it("リンククリックが親要素に伝播しない", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
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

  it("hideImages: false のとき画像は折りたたまれない(動画のみ折りたたみでもリンクは出る)", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
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

  it("videoPlayer > videoComponent の入れ子では最も内側だけが処理される", () => {
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
    expect(component.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(player.classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it("祖先が処理済みの場合、後から追加された内側の要素は処理されない", () => {
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

  it("二重に走査してもリンクは重複しない", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
        <div data-testid="tweetPhoto"></div>
      </article>
    `;
    const hider = createMediaHider(() => makeSettings());

    hider.scanAndHide(document.body);
    hider.scanAndHide(document.body);

    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });

  it("動画折りたたみ時に video.pause() が呼ばれる", () => {
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

describe("handleToggle", () => {
  it("OFF で全展開しリンクを除去、ON では revealed 済みも含め再度折りたたみリンクを再挿入する", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweetText">本文</div>
        <div data-testid="tweetPhoto" id="p1"></div>
        <div data-testid="tweetPhoto" id="p2"></div>
      </article>
    `;
    const settings = makeSettings();
    const hider = createMediaHider(() => settings);
    hider.scanAndHide(document.body);

    const post = query('article[data-testid="tweet"]');
    const p1 = query("#p1");
    const p2 = query("#p2");
    const kind: MediaKind = "image";

    // p1 はユーザーがリンククリックで個別に表示済みとする想定を再現
    hider.revealPost(post);
    expect(p1.getAttribute(REVEALED_ATTR)).toBe("true");
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);

    // 再度折りたたませてから OFF を確認する
    hider.handleToggle(kind, true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);

    hider.handleToggle(kind, false);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(0);

    hider.handleToggle(kind, true);
    expect(p1.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p2.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(p1.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(p2.getAttribute(REVEALED_ATTR)).toBeNull();
    expect(document.querySelectorAll(`.${REVEAL_LINK_CLASS}`)).toHaveLength(1);
  });
});
