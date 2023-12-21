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
                audio: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId
                    }
                }
            })
        } catch (error) {
            isError = true;
            console.log(error)
        }

        try {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false },
            })
        } catch (error) {
            console.log(error)
        }

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        if(desktopStream) {
            const desktopAudioSource = audioContext.createMediaStreamSource(desktopStream);
            desktopAudioSource.connect(destination);
        }

        if(microphoneStream) {
            const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
            microphoneSource.connect(destination);
        }

        // Combine the audio streams
        const combinedAudioStream = destination.stream;

        // Merge the audio and video streams
        const combinedStream = new MediaStream();
        combinedStream.addTrack(combinedAudioStream.getAudioTracks()[0]);

        if(desktopStream) {
            combinedStream.addTrack(desktopStream.getVideoTracks()[0]);
        }

        // Create a MediaRecorder to record the combined stream
        recorder = new MediaRecorder(combinedStream);

        recorder.ondataavailable = (event) => {
            data.push(event.data);
        };
        recorder.onstop = () => {
            if(!isError) {
                const blob = new Blob(data, { type: 'video/webm' });
                fetchBlob(blob).catch(err => console.log(err))
            }
            isError = false;
            recorder = undefined;
            data = [];
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
