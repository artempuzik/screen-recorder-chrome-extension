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

let recorder;
let data = [];

async function startRecording(streamId) {
    if (recorder?.state === 'recording') {
        throw new Error('Called startRecording while recording is in progress.');
    }

    const media = await navigator.mediaDevices.getUserMedia({
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

    const output = new AudioContext();
    const source = output.createMediaStreamSource(media);
    source.connect(output.destination);

    recorder = new MediaRecorder(media, { mimeType: 'video/webm' });
    recorder.ondataavailable = (event) => data.push(event.data);
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
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
    window.location.hash = '';
}
