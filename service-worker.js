chrome.action.onClicked.addListener(async (tab) => {
  const existingContexts = await chrome.runtime.getContexts({});
  let recording = false;
  const offscreenDocument = existingContexts.find(
      (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
  );

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
    chrome.action.setIcon({ path: 'icons/not-recording.png' });
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

  chrome.action.setIcon({ path: '/icons/recording.png' });
});
