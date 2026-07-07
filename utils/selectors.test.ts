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
  it("素の tweetPhoto は image と判定する", () => {
    const el = fromHTML(`<div data-testid="tweetPhoto"></div>`);
    expect(detectMediaKind(el)).toBe("image");
  });

  it("video 要素を内包する tweetPhoto は video と判定する", () => {
    const el = fromHTML(`<div data-testid="tweetPhoto"><video></video></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });

  it("videoPlayer 祖先の配下にある tweetPhoto(動画サムネイル)は video と判定する", () => {
    const root = fromHTML(
      `<div data-testid="videoPlayer"><div data-testid="tweetPhoto"></div></div>`,
    );
    const photo = root.querySelector('[data-testid="tweetPhoto"]');
    if (!photo) throw new Error("fixture must contain tweetPhoto");
    expect(detectMediaKind(photo)).toBe("video");
  });

  it("videoComponent 自身は video と判定する", () => {
    const el = fromHTML(`<div data-testid="videoComponent"></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });

  it("videoPlayer 自身は video と判定する", () => {
    const el = fromHTML(`<div data-testid="videoPlayer"></div>`);
    expect(detectMediaKind(el)).toBe("video");
  });
});
