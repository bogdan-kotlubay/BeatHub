import { writable, derived, readable, get } from "svelte/store";
import JSZip from "jszip";
const Store = require("electron-store");
const storage = new Store();

const { remote } = window.require("electron");
const fs = remote.require("fs");

async function downloadBeatmap(beatmap, downloadDirectory) {
  const resp = await fetch(`https://beatsaver.com` + beatmap.directDownload);
  const blob = await resp.blob();

  const zip = new JSZip();
  await zip.loadAsync(blob);

  Object.keys(zip.files).forEach(async filename => {
    const content = await zip.file(filename).async("nodebuffer");
    const songFolderName = formatFolderName(beatmap);
    const destFolder = `${downloadDirectory}/${songFolderName}/`;

    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    const dest = destFolder + filename;

    fs.writeFileSync(dest, content);
  });
}

function formatFolderName(beatmap) {
  const key = beatmap.key;
  const { songName, levelAuthorName } = beatmap.metadata;

  return `${key} (${songName.replace(
    /[\\/:*?"<>|.]/g,
    ""
  )} - ${levelAuthorName})`;
}

function getDownloadDirectory() {
  const hasDownloadDirectory = storage.has("downloadDirectory");

  if (hasDownloadDirectory) {
    return storage.get("downloadDirectory");
  } else {
    return "C:/Program Files (x86)/Steam/steamapps/common/Beat Saber/Beat Saber_Data/CustomLevels";
  }
}

function createDownloadsStore() {
  const store = writable({
    downloadDirectory: "",
    downloading: {},
    completed: {}
  });

  store.update(current => ({
    ...current,
    downloadDirectory: getDownloadDirectory()
  }));

  return {
    subscribe: store.subscribe,
    init: async () => {},
    changeDownloadDirectory: async newDirectory => {
      store.update(current => ({
        ...current,
        downloadDirectory: newDirectory
      }));
      storage.set("downloadDirectory", newDirectory);
    },
    download: async beatmap => {
      const { downloadDirectory } = get(store);
      store.update(current => {
        return {
          ...current,
          downloading: {
            ...current.downloading,
            [beatmap.key]: beatmap
          }
        };
      });

      await downloadBeatmap(beatmap, downloadDirectory);

      store.update(current => {
        const newDownloading = { ...current.downloading };
        delete newDownloading[beatmap.key];
        return {
          ...current,
          downloading: newDownloading,
          completed: {
            ...current.completed,
            [beatmap.key]: beatmap
          }
        };
      });
    }
  };
}

export const downloads = createDownloadsStore();
