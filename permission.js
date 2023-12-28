const sendMsgToSW = (msg) => {
    navigator.serviceWorker.controller.postMessage(msg);
};

const requestTabMediaPermission = async (streamId) => {
    if (streamId === null || !streamId) {
        return;
    }

    try {
        await navigator.mediaDevices.getUserMedia({
            audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } },
            video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } },
        });

        sendMsgToSW({ action: 'closePermissionTab' });
    } catch (error) {
        console.error("Error requesting media permission:", error);
        sendMsgToSW({ action: 'closePermissionTab' });
    }
};

const getPermission = async () => {
    try {
        chrome.desktopCapture.chooseDesktopMedia(["tab"], async (streamId) => {
            await requestTabMediaPermission(streamId);
        });
    } catch (error) {
        console.error("Error permission:", error);
    }
};

chrome.runtime.onMessage.addListener(async (request) => {
    switch (request.type) {
        case "get-permission":
            await getPermission();
            break;
        default:
            console.log("default");
    }
    return true;
});
