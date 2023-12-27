const updateRecording = async (state, type) => {
  chrome.storage.local.set({ recording: state, type });
};

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const activeTab = await chrome.tabs.get(activeInfo.tabId);
  if (!activeTab) return;
  const tabUrl = activeTab.url;

  if (
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://")
  ) {
    return;
  }
});

const startRecording = async (type) => {
  await updateRecording(true, type);
  chrome.action.setIcon({ path: "icons/recording.png" });
  if (type === "screen") {
    await recordScreen();
  }
};

const stopRecording = async () => {
  await updateRecording(false, "");
  chrome.action.setIcon({ path: "icons/not-recording.png" });
};

const recordScreen = async () => {
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

  setTimeout(() => {
    chrome.tabs.sendMessage(newTab.id, {
      type: "start-recording",
      focusedTabId: currentTabId,
    });
  }, 500);
};

chrome.runtime.onMessage.addListener(async (request, sender) => {
  switch (request.type) {
    case "start-recording":
      await startRecording(request.recordingType);
      break;
    case "stop-recording":
      await stopRecording();
      break;
    default:
      console.log("default");
  }

  return true;
});
