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

async function startRecording(streamId) {
    if (recorder?.state === 'recording') {
        return;
    }

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
    });
    microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 16000,
            sampleSize: 16,
            volume: 1
        }
    });

    const audioContext = new AudioContext();
    const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);

    // Create a MediaStreamAudioDestinationNode
    const destination = audioContext.createMediaStreamDestination();
    const desktopAudioSource = audioContext.createMediaStreamSource(desktopStream);
    desktopAudioSource.connect(destination);
    microphoneSource.connect(destination);

    // Combine the audio streams
    const combinedAudioStream = destination.stream;

    // Merge the audio and video streams
    const combinedStream = new MediaStream();
    combinedStream.addTrack(combinedAudioStream.getAudioTracks()[0]);
    combinedStream.addTrack(desktopStream.getVideoTracks()[0]);

    // Create a MediaRecorder to record the combined stream
    recorder = new MediaRecorder(combinedStream);

    recorder.ondataavailable = (event) => {
        data.push(event.data);
    };
    recorder.onstop = () => {
        const blob = new Blob(data, { type: 'video/webm' });
        fetchBlob(blob).catch(err => console.log(err))
        recorder = undefined;
        data = [];
    };
    recorder.start();
    window.location.hash = 'recording';
}

async function stopRecording() {
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
}
