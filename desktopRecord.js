chrome.runtime.onMessage.addListener(function (request, sender) {
    console.log("message received", request, sender);

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
        recorder.stream.getTracks().forEach((t) => t.stop());
    }
};

const startRecording = async (focusedTabId) => {
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

            const microphone = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false },
            });

            if (microphone.getAudioTracks().length !== 0) {
                const combinedStream = new MediaStream([
                    stream.getVideoTracks()[0],
                    microphone.getAudioTracks()[0],
                ]);

                recorder = new MediaRecorder(combinedStream, {
                    mimeType: "video/webm",
                });

                recorder.ondataavailable = (event) => {
                    data.push(event.data);
                };

                recorder.onstop = async () => {
                    console.log("recording stopped");
                    // send the data to the service worker
                    const blobFile = new Blob(data, { type: "video/webm" });
                    const base64 = await fetchBlob(URL.createObjectURL(blobFile));
                    console.log("base64", base64)
                    window.close();
                    data = [];
                };

                recorder.start();

                if (focusedTabId) {
                    chrome.tabs.update(focusedTabId, { active: true });
                }
            }

            return;
        }
    );
};
