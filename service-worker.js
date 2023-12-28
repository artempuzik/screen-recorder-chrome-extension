
// <---- SCREEN ---->
const isRecordingActive = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get('recording', (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        resolve(!!result.recording);
      }
    });
  });
};
self.addEventListener('message', async (event) => {
  if (event.data && event.data.action === 'startRecordScreen') {
    const isActive = await isRecordingActive();
    isActive ?
        chrome.runtime.sendMessage({
          type: 'stop-recording',
        }) :
        await startRecording('screen');
  }
});

const updateRecording = async (state, type) => {
  await chrome.storage.local.set({ recording: state, type });

};
const openNewTab = async (url) => {
  return await chrome.tabs.create({
    url,
    pinned: true,
    active: true,
    index: 0,
  });
};

const sendMessageToTab = (tabId, message) => {
  chrome.tabs.sendMessage(tabId, message);

};
const startRecording = async (type) => {
  await updateRecording(true, type);

  chrome.action.setIcon({ path: "icons/recording.png" });
  if (type === "screen") {
    const desktopRecordPath = chrome.runtime.getURL("desktopRecord.html");

    const currentTab = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab && currentTab.length > 0) {
      const currentTabId = currentTab[0].id;

      const newTab = await openNewTab(desktopRecordPath);
      setTimeout(() => {
        sendMessageToTab(newTab.id, {
          type: "start-recording",
          focusedTabId: currentTabId,
        });
      }, 500);
    }
  }
};

const stopRecording = async () => {
  await updateRecording(false, "");
  chrome.action.setIcon({ path: "icons/not-recording.png" });
  // chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  //   const currentTabId = tabs[0].id;
  //   chrome.tabs.remove(currentTabId, function() {
  //     console.log('Closed recording')
  //   });
  // });
};

chrome.runtime.onMessage.addListener(async (request) => {
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

// <--- OFFSET --->

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find(
        (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
    );

    const isActive = await isRecordingActive();

    let recording = false;

    if (isActive && recording) {
      chrome.runtime.sendMessage({
        type: 'stop-recording',
      });
      await stopRecording()
      return;
    }

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
      chrome.runtime.sendMessage({
        type: 'stop-recording',
        target: 'offscreen'
      });
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
    chrome.runtime.sendMessage({
      type: 'stop-recording',
      target: 'offscreen'
    });
    await stopRecording()
  }
});
