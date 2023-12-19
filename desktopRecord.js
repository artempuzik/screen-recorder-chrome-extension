const convertBlobToBase64 = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });
};

const fetchBlob = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const base64 = await convertBlobToBase64(blob);
  const filename =`record-${Date.now()}.webm`;
  if(window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, filename);
  } else{
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
  return base64;
};

// listen for messages from the service worker - start recording  - stop recording
chrome.runtime.onMessage.addListener(function (request, sender) {

  switch (request.type) {
    case "start-recording":
      startRecording(request.focusedTabId);
      break;
    case "stop-recording":
      stopRecording();
      break;
    default:
      console.log("default");
  }

  return true;
});

let recorder;
let data = [];

const stopRecording = () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    // stop all streams
    recorder.stream.getTracks().forEach((t) => t.stop());
  }
};

const startRecording = async (focusedTabId) => {
  //...
  // use desktopCapture to get the screen stream
  chrome.desktopCapture.chooseDesktopMedia(
    ["screen"],
    async function (streamId) {
      if (streamId === null) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
          },
        },
      });

      // get the microphone stream
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false },
      });

      // check that the microphone stream has audio tracks
      if (microphone.getAudioTracks().length !== 0) {
        const combinedStream = new MediaStream([
          stream.getVideoTracks()[0],
          microphone.getAudioTracks()[0],
        ]);

        recorder = new MediaRecorder(combinedStream, {
          mimeType: "video/webm",
        });

        // listen for data
        recorder.ondataavailable = (event) => {
          data.push(event.data);
        };

        // listen for when recording stops
        recorder.onstop = async () => {
          // send the data to the service worker
          const blobFile = new Blob(data, { type: "video/webm" });
          await fetchBlob(URL.createObjectURL(blobFile));
          window.close();
          data = [];
        };

        // start recording
        recorder.start();

        // set focus back to the previous tab
        if (focusedTabId) {
          chrome.tabs.update(focusedTabId, { active: true });
        }
      }

      return;
    }
  );
};
