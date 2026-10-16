# Cliprame Recorder (Chrome extension)

Records a browser tab with your camera and voice, and hides private data on the page before it reaches the recording. Finished recordings open in the Cliprame editor.

Plain JavaScript, Manifest V3, no build step. Requires Chrome 116 or later.

## Load it in Chrome

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `extension/` folder.
3. Pin **Cliprame Recorder** to the toolbar.
4. Open the popup and click **Allow camera and microphone** once.

After editing any file, click the reload icon on the extension card. Content scripts only update in tabs you reload.

## Recording

1. Open the tab you want to record and click the Cliprame button, or press **⌥⇧R** (Alt+Shift+R). You can change the shortcut at `chrome://extensions/shortcuts`.
2. The **Record** tab shows a live preview of the camera bubble over the tab, with a mic level meter. Turn the camera bubble, microphone and 3-second countdown on or off; your choices are remembered.
3. Click **Start recording**. The countdown is drawn on the page and removed before capture starts, so it never appears in the video. Press Esc to cancel it. The toolbar icon shows `REC`.
4. While recording, the popup shows a timer with **Pause/Resume**, **Finish** and **Discard** (with a confirm step). The shortcut also finishes the recording.
5. When you finish, the review page opens. You can rename the recording, see its length, size and resolution, open it in Cliprame, download it (WebM), delete it, or switch between your recent recordings.

The camera marker can be dragged anywhere, and double-clicking it cycles through three sizes. Your live face shows in the popup preview.

How it works:
- `background.js` gets a tab-capture stream ID and keeps the recording state in `chrome.storage.session`, because the service worker can be stopped at any time.
- `offscreen.html` / `offscreen.js` records the tab with `MediaRecorder` (up to 1080p, 30 fps). It mixes tab audio with the microphone and plays tab audio back so you still hear it.
- The camera is recorded by the recorder itself and drawn onto each frame (`lib/compositor.js`, using insertable streams). It runs at the camera's frame rate, so the bubble stays smooth even on a still page. It works on every site, including sites whose Permissions-Policy blocks cameras in embedded frames.
- On the page you see a marker where the camera will appear. Drag it to move it, and double-click to resize it. The recorder draws the live camera exactly over the marker, so the marker never shows in the video. The marker comes back after the page navigates if you allowed site access when starting.
- Recordings are kept in the extension's IndexedDB (`lib/recordings.js`), up to the latest five.

## Privacy masks

Open the **Privacy** tab in the popup and turn masks on for the site. Chrome asks for access to that site only. The Record tab shows whether masks are on and how many are active.

You can:
- **Pick on the page**: hover to see what will be hidden, click to mask it, and click a masked element to show it again. A bar at the top counts hidden elements. Press Esc or **Done** to finish.
- **Mask patterns automatically**: emails, phone numbers, card numbers (Luhn-checked), API keys and tokens (Stripe, AWS, GitHub, Google, Slack, OpenAI, JWTs), PAN and Aadhaar numbers.
- **Mask custom words**: type a word, such as a client or project name, and press Enter to add it.
- **Mask form fields**: hides text typed into form fields.
- **Choose a style**: a solid block, or blur for picked elements and form fields. Matched text is always covered solidly, because blurred short text can still be read.

Masks are saved per site in `chrome.storage.local` and show on the page as soon as you turn them on, so you can check them before recording.

How it works (`mask.js`):
- Masks are drawn by the page itself, so private pixels never reach the capture. They are not blurred afterwards.
- Picked elements and form fields are covered by an injected stylesheet.
- Text matches are painted with the CSS Custom Highlight API. This styles text ranges without editing the page's DOM, so apps like React keep working.
- A `MutationObserver` re-checks new or changed text. Its callbacks run before the browser paints, so new text is masked in the frame where it first appears.
- On page load, the page stays hidden until the rules have loaded (at most 1.5 seconds).

Limits:
- Only tabs are masked. Other desktop apps aren't, because this version records tabs only.
- Text inside images, `<canvas>`, video and closed shadow DOM can't be matched by pattern. Use **Pick elements** to cover those areas.
- Each frame uses the rules for its own site. Embedded frames from other sites are masked only if masking is on for that site too.
- Picked elements are remembered by CSS selector. On sites whose markup changes a lot, check the masks before recording.
- A pattern can't match text that is split across elements. For example, an email with a bold part is two text nodes.

## Sending a recording to Cliprame

**Edit in Cliprame** opens `/studio?import=extension&recording=<id>` on the address chosen on the review page (cliprame.com or `localhost:3000`):

1. The studio posts an `import-ready` message.
2. `cliprame-bridge.js` (a content script on Cliprame pages only) adds a hidden `bridge.html` frame.
3. The frame sends the video file to the page with `postMessage`, but only when the parent page is a Cliprame address.
4. The studio opens it in the editor.

If you aren't signed in, the import link is kept through login.

The allowed Cliprame addresses are listed in three places that must stay in sync: `manifest.json` (content script and web-accessible resources), `bridge.js` (`ALLOWED`) and `result.html` (the "Open in" options).

## Troubleshooting

**The popup says "Camera bubble removed".**
The recorder couldn't open your camera. The message says why: access not set up, the camera is in use by another app, or Chrome is blocked in your computer's privacy settings. Camera permission belongs to the extension (`chrome-extension://…`), not the site you record. Allow it once from the popup with **Allow camera and microphone**. If it was blocked before, reset it under `chrome://settings/content/camera`.

The popup won't start with the camera or mic switched on until access is set up. **Record without them this time** records with whatever is already allowed.

## Design

Every page uses the shared tokens in `theme.css` and the Lucide icons in `icons.svg`. Light and dark mode follow the system setting, and animations respect reduced motion. The overlays drawn inside recorded pages (picker, countdown, camera bubble) are styled inline or in a closed shadow root, so the page's own CSS can't change them.

## Permissions

| Permission | Why |
|---|---|
| `tabCapture` | Record the tab you start from |
| `offscreen` | Run `MediaRecorder`, which service workers can't |
| `activeTab`, `scripting` | Add the camera bubble and masks to the current tab |
| `storage` | Recording state and per-site mask rules |
| Optional site access | Requested per site when masking or the camera bubble is turned on |
