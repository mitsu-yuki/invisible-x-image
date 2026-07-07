export interface Settings {
  hideImages: boolean;
  hideVideos: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  hideImages: true,
  hideVideos: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get({ ...DEFAULT_SETTINGS });
  return {
    hideImages: (stored.hideImages as boolean | undefined) ?? DEFAULT_SETTINGS.hideImages,
    hideVideos: (stored.hideVideos as boolean | undefined) ?? DEFAULT_SETTINGS.hideVideos,
  };
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await browser.storage.sync.set({ [key]: value });
}

/**
 * Subscribes to changes on browser.storage.sync. The callback receives the
 * full updated Settings plus a diff of which keys changed.
 * Call the returned function to unsubscribe.
 */
export function onSettingsChanged(
  callback: (settings: Settings, changedKeys: Partial<Record<keyof Settings, boolean>>) => void,
): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== "sync") return;

    const changedKeys: Partial<Record<keyof Settings, boolean>> = {};
    let hasRelevantChange = false;

    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (key in changes) {
        changedKeys[key] = true;
        hasRelevantChange = true;
      }
    }

    if (!hasRelevantChange) return;

    getSettings().then((settings) => callback(settings, changedKeys));
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
