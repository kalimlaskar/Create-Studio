// Live camera for the bubble the recorder places on the captured page.
// If the camera can't start, tell the background so it removes the bubble
// instead of recording an error message.
const video = document.getElementById('video');
const message = document.getElementById('message');

function explain(error) {
    if (error.name === 'NotAllowedError' && /system/i.test(error.message)) return 'Chrome isn’t allowed to use the camera in your computer’s privacy settings.';
    if (error.name === 'NotAllowedError') return 'Camera access isn’t set up for the recorder yet. Open the Cliprame popup and choose “Allow camera and microphone”.';
    if (error.name === 'NotReadableError') return 'Your camera is being used by another app.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No camera was found.';
    return `The camera couldn’t start (${error.message || error.name}).`;
}

navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
    .then((stream) => { video.srcObject = stream; })
    .catch((error) => {
        message.hidden = false;
        message.textContent = 'Camera unavailable';
        void chrome.runtime.sendMessage({ target: 'background', type: 'camera-failed', reason: explain(error) });
    });
