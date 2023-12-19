// check
const checkRecording = async () => {
  const recording = await chrome.storage.local.get(["recording", "type"]);
  const recordingStatus = recording.recording || false;
  const recordingType = recording.type || "";
  return [recordingStatus, recordingType];
};

// update recording state
const updateRecording = async (state, type) => {
  chrome.storage.local.set({ recording: state, type });
};

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

// listen for changes to the focused / current tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // grab the tab
  const activeTab = await chrome.tabs.get(activeInfo.tabId);
  if (!activeTab) return;
  const tabUrl = activeTab.url;

  // if chrome or extension page, return
  if (
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://")
  ) {
    console.log("WORKER - chrome or extension page - exiting");
    return;
  }

  // check if we are recording & if we are recording the scren
  const [recording, recordingType] = await checkRecording();

  if (recording && recordingType === "screen") {
    // inject the camera
    await injectCamera();
  } else {
    // remove the camera
    await removeCamera();
  }
});

const startRecording = async (type) => {
  await updateRecording(true, type);
  // update the icon
  chrome.action.setIcon({ path: "icons/recording.png" });
  if (type === "screen") {
    await recordScreen();
  }
};

const stopRecording = async () => {
  await updateRecording(false, "");
  // update the icon
  chrome.action.setIcon({ path: "icons/not-recording.png" });
};

const recordScreen = async () => {
  // create a pinned focused tab - with an index of 0
  const desktopRecordPath = chrome.runtime.getURL("desktopRecord.html");

  const currentTab = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const currentTabId = currentTab[0].id;

  const newTab = await chrome.tabs.create({
    url: desktopRecordPath,
    pinned: true,
    active: true,
    index: 0,
  });

  // wait for 500ms send a message to the tab to start recording
  setTimeout(() => {
    chrome.tabs.sendMessage(newTab.id, {
      type: "start-recording",
      focusedTabId: currentTabId,
    });
  }, 500);
};

// add listender for messages
chrome.runtime.onMessage.addListener((request) => {
  switch (request.type) {
    case "start-recording":
      startRecording(request.recordingType);
      break;
    case "stop-recording":
      stopRecording();
      break;
    default:
      console.log("default");
  }

  return true;
});
