let socket = null;
let recorder;
let connectingCounter = 0;

const connectWebSocket = () => {
  if (connectingCounter === 20) {
    return;
  }
  socket = new WebSocket("wss://chromefeed.away.guru/video");

  socket.addEventListener("open", function (event) {
    console.log("WebSocket connected!", event);
    connectingCounter = 0;
  });

  socket.addEventListener("error", function (error) {
    connectingCounter++;
    console.error("WebSocket error:", error);
  });

  socket.addEventListener("close", function (event) {
    connectingCounter++;
    console.log("WebSocket connection closed:", event);
  });
};

const stopRecording = () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
  }
};

const startRecording = async (focusedTabId) => {
  try {
    chrome.desktopCapture.chooseDesktopMedia(
        ["screen"],
        async function (streamId) {
          if (streamId === null) {
            return;
          }

          if (!streamId) return;

          const combinedStream = await getCombinedStream(streamId);

          connectWebSocket();

          recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp8,opus',
          });

          recorder.ondataavailable = handleDataAvailable;
          recorder.onerror = handleError;
          recorder.onstop = handleRecorderStop;

          recorder.start();

          if (focusedTabId) {
            chrome.tabs.update(focusedTabId, { active: true });
          }
          return;
        });
  } catch (error) {
    console.error("Error starting recording:", error);
  }
};

const getCombinedStream = async (streamId) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } },
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } },
  });

  const microphone = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false },
  });

  const combinedStream = new MediaStream([
    stream.getVideoTracks()[0],
    microphone.getAudioTracks()[0],
  ]);

  return combinedStream;
};

const handleDataAvailable = (event) => {
  if (!socket) return;
  if (event.data.size > 0) {
    socket.send(event.data);
  }
};

const handleError = (error) => {
  console.log("Error", error);
  if (socket) {
    socket.close();
  }
};

const handleRecorderStop = () => {
  recorder = undefined;
  if (socket) {
    socket.close();
  }
  alert("Recorder stopped");
  window.close();
};

chrome.runtime.onMessage.addListener(async (request) => {
  switch (request.type) {
    case "start-recording":
      await startRecording(request.focusedTabId);
      break;
    case "stop-recording":
      stopRecording();
      break;
    default:
      console.log("default");
  }
  return true;
});
