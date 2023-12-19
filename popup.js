const injectCamera = async () => {
  // inject the content script into the current page
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const tabId = tab[0].id;
  await chrome.scripting.executeScript({
    // content.js is the file that will be injected
    files: ["content.js"],
    target: { tabId },
  });
};

const removeCamera = async () => {
  // inject the content script into the current page
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const tabId = tab[0].id;
  await chrome.scripting.executeScript({
    // content.js is the file that will be injected
    func: () => {
      const camera = document.querySelector("#camera");
      if (!camera) return;
      document.querySelector("#camera").style.display = "none";
    },
    target: { tabId },
  });
};

// check chrome storage if recording is on
const checkRecording = async () => {
  const recording = await chrome.storage.local.get(["recording", "type"]);
  const recordingStatus = recording.recording || false;
  const recordingType = recording.type || "";
  return [recordingStatus, recordingType];
};

const updateRecording = async (type) => {
  const recordingState = await checkRecording();

  if (recordingState[0] === true) {
    // stop recording
    chrome.runtime.sendMessage({ type: "stop-recording" });
    await removeCamera();
  } else {
    // send message to service worker to start recording
    chrome.runtime.sendMessage({
      type: "start-recording",
      recordingType: type,
    });
    await injectCamera();
  }

  // close popup
  //window.close();
};
const init = async () => {
  await updateRecording("screen");
};

init().catch(err => console.log(err));
