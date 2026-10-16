// Finished recordings, stored in the extension's own IndexedDB until they are
// downloaded or sent to Cliprame. Shared by the offscreen recorder, the review
// page and the Cliprame bridge, which all run on the extension origin.

const DB_NAME = 'cliprame-recorder';
const STORE = 'recordings';
const KEEP_LATEST = 5;

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function run(mode, action) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(request?.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

/** Saves a recording and drops the oldest ones beyond KEEP_LATEST. */
export async function saveRecording(recording) {
    await run('readwrite', (store) => store.put(recording));
    const all = await run('readonly', (store) => store.getAll());
    const stale = all.sort((a, b) => b.createdAt - a.createdAt).slice(KEEP_LATEST);
    await Promise.all(stale.map((item) => run('readwrite', (store) => store.delete(item.id))));
}

export function getRecording(id) {
    return run('readonly', (store) => store.get(id));
}

/** All kept recordings, newest first. */
export async function listRecordings() {
    const all = await run('readonly', (store) => store.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateRecording(id, patch) {
    const current = await getRecording(id);
    if (current) await run('readwrite', (store) => store.put({ ...current, ...patch }));
}

export function deleteRecording(id) {
    return run('readwrite', (store) => store.delete(id));
}
