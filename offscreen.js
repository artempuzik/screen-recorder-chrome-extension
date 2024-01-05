let socket = null;
let connectingCounter = 0;
let pipe = [];
let recorder;

const fetchBlob = async (blob) => {
    const name =`record-${Date.now()}.webm`;
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, name);
    } else{
        const elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = name;
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    }
};

const sendMsgToSW = (msg) => {
    navigator.serviceWorker.controller.postMessage(msg);
}

const connectWebSocket = (token) => {
    if (connectingCounter === 20) {
        return;
    }
    socket = new WebSocket("wss://chromefeed.away.guru/video");

    socket.addEventListener("open", async (event) => {
        console.log("WebSocket connected!", event);
        const msg = await (new Blob([`{"token": ${token}`], {type: 'text/javascript'})).arrayBuffer()
        socket.send(msg);
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

const handleDataAvailable = async (event) => {
    pipe.push(event.data);
    if (!socket) return;
    if (event.data.size > 0) {
        const data = await event.data.arrayBuffer();
        socket.send(data);
    }
};

const handleError = (error) => {
    console.log("Error", error);
    if (socket) {
        socket.close();
    }
};

const handleRecorderStop = () => {
    try {
        if(pipe.length > 0) {
            const blob = new Blob(pipe, { type: 'video/webm' });
            fetchBlob(blob).catch(err => console.log(err));
        }
    } catch (e) {
        console.log("Fetch error", e.message);
    }
    recorder = undefined;
    window.location.hash = '';
    setTimeout(() => {
        if (socket) {
            socket.close();
        }
    }, 5000)
};

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target === 'offscreen') {
        switch (message.type) {
            case 'start-recording':
                await startRecording(message.data, message.token);
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

        recorder.start(1);
        window.location.hash = 'recording';

    } catch (error) {
        console.log(error)
        sendMsgToSW({ action: 'getPermission' });
        await stopRecording();
    }
}

async function stopRecording() {
    try {
        if (recorder?.state === "recording") {
            recorder.stop();
            recorder.stream.getTracks().forEach((t) => t.stop());
        }
        window.location.hash = '';
    } catch (e) {
        console.log(e)
    }
}
