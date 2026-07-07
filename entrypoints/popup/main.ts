import { getSettings, setSetting } from "../../utils/settings";

const hideImagesInput = document.querySelector<HTMLInputElement>("#hide-images");
const hideVideosInput = document.querySelector<HTMLInputElement>("#hide-videos");

async function init() {
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
