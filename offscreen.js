let socket = null;
let connectingCounter = 0;
let recorder;

const sendMsgToSW = (msg) => {
    navigator.serviceWorker.controller.postMessage(msg);
}

const connectWebSocket = () => {
    if (connectingCounter === 20) {
        return;
    }
    socket = new WebSocket("wss://chromefeed.away.guru/video");

    socket.addEventListener("open", function(event) {
        console.log("WebSocket connected!", event);
        connectingCounter = 0;
    });

    socket.addEventListener("error", function(error) {
        connectingCounter++
        console.error("WebSocket error:", error);
    });

    socket.addEventListener("close", function(event) {
        connectingCounter++
        console.log("WebSocket connection closed:", event);
    });
}

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
    window.location.hash = '';
};

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target === 'offscreen') {
        switch (message.type) {
            case 'start-recording':
                await startRecording(message.data);
                break;
            case 'stop-recording':
                await stopRecording();
                break;
            default:
                throw new Error('Unrecognized message:', message.type);
        }
    }
});

const getCombinedStream = async (streamId) => {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
        video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    });

    const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false },
    });

    if (microphone.getAudioTracks().length !== 0) {
        const combinedStream = new MediaStream([
            stream.getVideoTracks()[0],
            microphone.getAudioTracks()[0],
        ]);

        return combinedStream;
    }
    return null;
};

async function startRecording(streamId) {
    if (recorder?.state === 'recording') {
        return;
    }

    if (!streamId) {
        return;
    }

    try {
        const combinedStream = await getCombinedStream(streamId);

        if (!combinedStream) {
            return;
        }

        connectWebSocket();

        recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp8,opus',
        });

        recorder.ondataavailable = handleDataAvailable;
        recorder.onerror = handleError;
        recorder.onstop = handleRecorderStop;

        recorder.start();
        window.location.hash = 'recording';

    } catch (error) {
        console.log(error)
        await stopRecording();
        sendMsgToSW({ action: 'startRecordScreen' });
    }
}

async function stopRecording() {
    try {
        if (recorder?.state === "recording") {
            recorder.stop();
            recorder.stream.getTracks().forEach((t) => t.stop());
        }
        if (socket) {
            socket.close();
        }
        window.location.hash = '';
    } catch (e) {
        console.log(e)
    }
}
