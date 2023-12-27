// const fetchBlob = async (blob) => {
//     const name =`record-${Date.now()}.webm`;
//     if(window.navigator.msSaveOrOpenBlob) {
//         window.navigator.msSaveBlob(blob, name);
//     } else{
//         const elem = window.document.createElement('a');
//         elem.href = window.URL.createObjectURL(blob);
//         elem.download = name;
//         document.body.appendChild(elem);
//         elem.click();
//         document.body.removeChild(elem);
//     }
// };

const fetchBlobToWs = async (data) => {
    const blobFile = new Blob(data, { type: "video/webm" });
    const base64 = await fetchBlob(URL.createObjectURL(blobFile));

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

let desktopStream; // variable to hold the desktop stream
let microphoneStream; // variable to hold the microphone stream
let data = []; // array to store recorded chunks
let recorder; // variable to hold the MediaRecorder instance
let isError = false;

async function startRecording(streamId) {
    if (recorder?.state === 'recording') {
        return;
    }

    try {
            desktopStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId
                    }
                }
            })
        } catch (error) {
            console.log(error)
        }

        try {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false },
            })
            throw new Error('Microphone');
        } catch (error) {
            console.log(error)
            openPinnedTabHandler();
        }

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        if(desktopStream.getAudioTracks().length) {
            const desktopAudioSource = audioContext.createMediaStreamSource(desktopStream);
            desktopAudioSource.connect(destination);
        }

        if(microphoneStream) {
            const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
            microphoneSource.connect(destination);
        }

        const combinedAudioStream = destination.stream;

        const combinedStream = new MediaStream();
        combinedStream.addTrack(combinedAudioStream.getAudioTracks()[0]);

        if(desktopStream) {
            combinedStream.addTrack(desktopStream.getVideoTracks()[0]);
        }

        const socket = new WebSocket("ws://chromefeed.away.guru/video");

        socket.addEventListener("open",function(event){
            socket.send("Connected.....");
        });

        socket.addEventListener("error", function (error) {
            console.error("WebSocket error:", error);
        });

        socket.addEventListener("close", function (event) {
            console.log("WebSocket connection closed:", event);
        });

        recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp8,opus',
        });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                const blob = new Blob([event.data], { type: 'video/webm' });
                //socket.send(blob);
                console.log(event.data)
            }
        };

        recorder.onerror = () => {
            console.log("Error", arguments);
            openPinnedTabHandler();
        };

        recorder.onstop = () => {
            // const blob = new Blob(data, { type: 'video/webm' });
            // fetchBlob(blob).catch(err => console.log(err))
            recorder = undefined;
            // data = [];
        };
        isError = false;
        recorder.start();
        window.location.hash = 'recording';
}

async function stopRecording() {
    try {
        if (desktopStream) {
            desktopStream.getTracks().forEach((track) => track.stop());
        }

        if (microphoneStream) {
            microphoneStream.getTracks().forEach((track) => track.stop());
        }

        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
        window.location.hash = '';
    } catch (e) {
        console.log(e)
    }
}
