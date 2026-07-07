import { getSettings, setSetting } from "../../utils/settings";

const hideImagesInput = document.querySelector<HTMLInputElement>("#hide-images");
const hideVideosInput = document.querySelector<HTMLInputElement>("#hide-videos");
const hideImagesLabel = document.querySelector<HTMLSpanElement>("#hide-images-label");
const hideVideosLabel = document.querySelector<HTMLSpanElement>("#hide-videos-label");

function applyI18n() {
  if (hideImagesLabel) hideImagesLabel.textContent = browser.i18n.getMessage("hideImages");
  if (hideVideosLabel) hideVideosLabel.textContent = browser.i18n.getMessage("hideVideos");
}

async function init() {
  applyI18n();
  const settings = await getSettings();
  if (hideImagesInput) hideImagesInput.checked = settings.hideImages;
  if (hideVideosInput) hideVideosInput.checked = settings.hideVideos;
}

hideImagesInput?.addEventListener("change", () => {
  setSetting("hideImages", hideImagesInput.checked);
});

hideVideosInput?.addEventListener("change", () => {
  setSetting("hideVideos", hideVideosInput.checked);
});

init();
