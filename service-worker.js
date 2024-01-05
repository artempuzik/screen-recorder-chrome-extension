let currentTab = null;
let newTab = null;
let authTab = null;
let token = null;

const urls = [
    'zoom',
    'meet.google',
    'teams'
]
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
  if (event.data && event.data.action === 'alert') {
    await stopRecording();
    if(!newTab) {
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.remove(newTab.id);
    });
  }
  if (event.data && event.data.action === 'set-token') {
    if(event.data.token) {
      token = event.data.token;
      try {
        if(authTab) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.remove(authTab.id, async () => {
              if(currentTab) {
                await startRecording(currentTab);
              }
            });
          });
        }
      } catch (e) {
        console.log(e)
      }
    } else {
      await openAuthTab()
    }
  }
});

const openNewTab = async () => {
    const desktopRecordPath = chrome.runtime.getURL("permission.html");
    const tab = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.length > 0) {
      const currentTabId = tab[0].id;

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

const openAuthTab = async () => {
  const desktopRecordPath = chrome.runtime.getURL("auth.html");
  const tab = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tab && tab.length > 0) {
    const currentTabId = tab[0].id;

    authTab = await chrome.tabs.create({
      url: desktopRecordPath,
      pinned: true,
      active: true,
      index: 0,
    });
  }
}

const stopRecording = async () => {
  chrome.runtime.sendMessage({
    type: 'stop-recording',
    target: 'offscreen'
  });
  chrome.action.setIcon({ path: "icons/not-recording.png" });
  newTab = null;
  authTab = null;
  currentTab = null;
};

const openFile = async (files, tab) => {
  await chrome.scripting.executeScript({
    files: [...files],
    target: { tabId: tab.id },
  });
}

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
      token: token,
      data: streamId
    });
    chrome.action.setIcon({ path: 'icons/recording.png' });

  } catch (e) {
    await stopRecording()
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if(tab.url.startsWith('chrome-extension://') || tab.url.startsWith('chrome://')) {
    return;
  }
  currentTab = tab;
  if(token) {
    await startRecording(tab);
  } else {
    await openAuthTab()
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, async (tab) => {
    const currentUrl = tab.url;
    const isMatch = !!urls.find(u => currentUrl.includes(u))
    if(isMatch) {
      await openFile(['alert.js'], tab)
    }
  });
});
