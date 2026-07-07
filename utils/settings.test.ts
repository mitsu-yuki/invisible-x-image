import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing";
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, setSetting } from "./settings";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("getSettings", () => {
  it("未保存時はデフォルト設定(両方 true)を返す", async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("setSetting", () => {
  it("setSetting で書き込んだ値が getSettings で読み出せる", async () => {
    await setSetting("hideImages", false);
    const settings = await getSettings();
    expect(settings).toEqual({ hideImages: false, hideVideos: true });
  });
});

describe("onSettingsChanged", () => {
  it("変更されたキーの diff 付きでコールバックが発火する", async () => {
    const callback = vi.fn();
    onSettingsChanged(callback);

    await setSetting("hideImages", false);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    expect(callback).toHaveBeenCalledWith(
      { hideImages: false, hideVideos: true },
      { hideImages: true },
    );
  });

  it("戻り値の関数で購読解除できる", async () => {
    const callback = vi.fn();
    const unsubscribe = onSettingsChanged(callback);
    unsubscribe();

    await setSetting("hideVideos", false);
    // マイクロタスクが残っていないことを確認するため一呼吸置く
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).not.toHaveBeenCalled();
  });
});
