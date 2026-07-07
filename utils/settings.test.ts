import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing";
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, setSetting } from "./settings";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("getSettings", () => {
  it("returns default settings (both true) when nothing is stored", async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("setSetting", () => {
  it("reads back via getSettings the value written by setSetting", async () => {
    await setSetting("hideImages", false);
    const settings = await getSettings();
    expect(settings).toEqual({ hideImages: false, hideVideos: true });
  });
});

describe("onSettingsChanged", () => {
  it("fires the callback with a diff of the changed keys", async () => {
    const callback = vi.fn();
    onSettingsChanged(callback);

    await setSetting("hideImages", false);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    expect(callback).toHaveBeenCalledWith(
      { hideImages: false, hideVideos: true },
      { hideImages: true },
    );
  });

  it("can unsubscribe via the returned function", async () => {
    const callback = vi.fn();
    const unsubscribe = onSettingsChanged(callback);
    unsubscribe();

    await setSetting("hideVideos", false);
    // Pause briefly to confirm no pending microtasks fire the callback
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).not.toHaveBeenCalled();
  });
});
