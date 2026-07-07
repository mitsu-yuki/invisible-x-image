import { describe, expect, it } from "vitest";
import { detectMediaKind } from "./selectors";

function fromHTML(html: string): Element {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const el = wrapper.firstElementChild;
  if (!el) throw new Error("fixture must contain an element");
  return el;
}

describe("detectMediaKind", () => {
  it("detects a plain tweetPhoto as image", () => {
    const el = fromHTML(`<div data-testid="tweetPhoto"></div>`);
    expect(detectMediaKind(el)).toBe("image");
  });

  it("detects a tweetPhoto containing a video element as video", () => {
    const el = fromHTML(`<div data-testid="tweetPhoto"><video></video></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });

  it("detects a tweetPhoto (video thumbnail) under a videoPlayer ancestor as video", () => {
    const root = fromHTML(
      `<div data-testid="videoPlayer"><div data-testid="tweetPhoto"></div></div>`,
    );
    const photo = root.querySelector('[data-testid="tweetPhoto"]');
    if (!photo) throw new Error("fixture must contain tweetPhoto");
    expect(detectMediaKind(photo)).toBe("video");
  });

  it("detects videoComponent itself as video", () => {
    const el = fromHTML(`<div data-testid="videoComponent"></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });

  it("detects videoPlayer itself as video", () => {
    const el = fromHTML(`<div data-testid="videoPlayer"></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });
});
