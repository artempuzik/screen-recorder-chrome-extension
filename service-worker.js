
let currentTab = null;
let newTab = null;
self.addEventListener('message', async (event) => {
  if (event.data && event.data.action === 'getPermission') {
    await openNewTab();
  }
  if (event.data && event.data.action === 'stopRecord') {
    await stopRecording();
    if(!newTab) {
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.remove(newTab.id);
    });
  }
  if (event.data && event.data.action === 'closePermissionTab') {
    if(!newTab) {
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.remove(newTab.id, async () => {
        if(currentTab) {
          await startRecording(currentTab);
        }
      });
    });
  }
});

const openNewTab = async () => {
    const desktopRecordPath = chrome.runtime.getURL("permission.html");
    const currentTab = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab && currentTab.length > 0) {
      const currentTabId = currentTab[0].id;

      newTab = await chrome.tabs.create({
        url: desktopRecordPath,
        pinned: true,
        active: true,
        index: 0,
      });

      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'get-permission',
        });
      }, 500);
    }
};

const stopRecording = async () => {
  chrome.runtime.sendMessage({
    type: 'stop-recording',
    target: 'offscreen'
  });
  chrome.action.setIcon({ path: "icons/not-recording.png" });
  currentTab = null;
  newTab = null;
};

// <--- OFFSET --->

const startRecording = async (tab) => {
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find(
        (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
    );

    let recording = false;

    if (!offscreenDocument) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording from chrome.tabCapture API'
      });
    } else {
      recording = offscreenDocument.documentUrl.endsWith('#recording');
    }

    if (recording) {
      await stopRecording()
      return;
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    chrome.runtime.sendMessage({
      type: 'start-recording',
      target: 'offscreen',
      data: streamId
    });
    chrome.action.setIcon({ path: 'icons/recording.png' });

  } catch (e) {
    await stopRecording()
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  await startRecording(tab);
});
