
// Dropbox Sync Helper v1
// Replace YOUR_DROPBOX_TOKEN with your token

const DROPBOX_FILE = "/inventory-manager-data.json";

async function uploadDataToDropbox(data) {
  const token = localStorage.getItem("dropbox_token");
  if (!token) return;

  try {
    await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Dropbox-API-Arg": JSON.stringify({
          path: DROPBOX_FILE,
          mode: "overwrite",
          autorename: false,
          mute: true
        }),
        "Content-Type": "application/octet-stream"
      },
      body: JSON.stringify({
        lastModified: Date.now(),
        data
      })
    });

    console.log("Dropbox sync upload OK");
  } catch (e) {
    console.error("Dropbox upload error", e);
  }
}

async function downloadDataFromDropbox() {
  const token = localStorage.getItem("dropbox_token");
  if (!token) return null;

  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Dropbox-API-Arg": JSON.stringify({
          path: DROPBOX_FILE
        })
      }
    });

    if (!res.ok) return null;

    return await res.json();
  } catch (e) {
    console.error("Dropbox download error", e);
    return null;
  }
}
