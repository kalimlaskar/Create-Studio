// Runs on Gmail. Adds a "Video" button next to Send in every compose and reply window.
// It lists your Cliprame videos, makes a personal link for the recipient, and inserts a
// clickable thumbnail at the cursor. API calls go through background.js, which is signed
// in to Cliprame with your browser's session.
//
// Gmail enforces Trusted Types, so nothing here uses innerHTML: every node is built with
// DOM calls, and styles are set through the CSSOM (constructed stylesheets and .style).
(() => {
    if (window.top !== window) return;

    const ATTACHED = 'data-cliprame-video';
    const SVG = 'http://www.w3.org/2000/svg';

    /* --------------------------------- helpers -------------------------------- */

    const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (value === undefined || value === null || value === false) continue;
            if (key === 'class') node.className = value;
            else if (key === 'style') Object.assign(node.style, value);
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
            else if (key in node && key !== 'list') node[key] = value;
            else node.setAttribute(key, value === true ? '' : value);
        }
        node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
        return node;
    };

    /** A Lucide icon from path data (24×24, stroke). */
    const icon = (paths, size = 18) => {
        const svg = document.createElementNS(SVG, 'svg');
        for (const [key, value] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
        for (const d of paths) {
            const path = document.createElementNS(SVG, 'path');
            path.setAttribute('d', d);
            svg.append(path);
        }
        return svg;
    };
    const ICONS = {
        close: ['M18 6 6 18', 'm6 6 12 12'],
        search: ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
        external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
        record: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    };

    /** The Cliprame logo, from the extension's own icons. */
    const logo = (size) => el('img', { src: chrome.runtime.getURL('icons/icon-48.png'), alt: '', width: size, height: size, style: { width: `${size}px`, height: `${size}px`, borderRadius: '5px', display: 'block' } });

    const clock = (ms) => {
        const total = Math.max(0, Math.round((ms || 0) / 1000));
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    };

    /** Asks background.js. Resolves to { ok, value } or { ok: false, error }. */
    const ask = (type, payload = {}) => new Promise((resolve) => {
        // After the extension is reloaded, this page's copy of the script is orphaned.
        if (!chrome.runtime?.id) return resolve({ ok: false, error: 'Cliprame was updated. Reload Gmail to use it again.' });
        try {
            chrome.runtime.sendMessage({ target: 'background', type, ...payload }, (response) => {
                if (chrome.runtime.lastError) resolve({ ok: false, error: 'Cliprame was updated. Reload Gmail to use it again.' });
                else resolve(response ?? { ok: false, error: 'No answer from Cliprame.' });
            });
        } catch {
            resolve({ ok: false, error: 'Cliprame was updated. Reload Gmail to use it again.' });
        }
    });

    /* ------------------------------ compose windows ----------------------------- */

    /** The send button's row in a compose or reply window. Gmail's class names have been stable for years; the tooltip is the fallback. */
    function toolbarFor(body) {
        let root = body;
        for (let depth = 0; root && depth < 30; depth += 1, root = root.parentElement) {
            const row = root.querySelector?.('tr.btC');
            if (row) return { root, row, send: row.querySelector('td.gU.Up') };
            const send = root.querySelector?.('[role="button"][data-tooltip*="Enter"]');
            if (send?.closest('tr')) return { root, row: send.closest('tr'), send: send.closest('td') };
        }
        return null;
    }

    /** People in the To field, from Gmail's recipient chips. Leaves out the signed-in account (it's in the tab title). */
    function recipientsIn(root) {
        const self = (document.title.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? '').toLowerCase();
        const seen = new Map(self ? [[self, null]] : []);
        for (const chip of root.querySelectorAll('[data-hovercard-id*="@"], span[email]')) {
            const email = (chip.getAttribute('data-hovercard-id') || chip.getAttribute('email') || '').trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
            // Chips can read "Sairin Laskar <sairin@…>", so the address part is taken out of the name.
            const raw = chip.getAttribute('data-name') || chip.getAttribute('name') || chip.textContent || '';
            const name = raw.replace(/<[^>]*>/g, '').replace(/\S+@\S+/g, '').replace(/["'(),]/g, ' ').replace(/\s+/g, ' ').trim();
            seen.set(email, { email, name: name.slice(0, 120) });
        }
        return [...seen.values()].filter(Boolean);
    }

    function attach(body) {
        if (body.hasAttribute(ATTACHED)) return;
        const found = toolbarFor(body);
        if (!found) return;
        body.setAttribute(ATTACHED, '');

        const button = el('div', {
            role: 'button',
            tabIndex: 0,
            'aria-label': 'Insert a Cliprame video',
            'data-tooltip': 'Insert a Cliprame video',
            style: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', marginLeft: '8px', borderRadius: '18px', border: '1px solid #dadce0', background: '#fff', color: '#3c4043', font: '500 14px/1 "Google Sans", Roboto, Arial, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' },
        }, logo(18), 'Video');
        button.addEventListener('mouseenter', () => { button.style.background = '#f6f4ff'; });
        button.addEventListener('mouseleave', () => { button.style.background = '#fff'; });

        // Remember the cursor before the panel takes focus, so the video lands where they were typing.
        let saved = null;
        const remember = () => {
            const selection = window.getSelection();
            if (selection?.rangeCount && body.contains(selection.getRangeAt(0).startContainer)) saved = selection.getRangeAt(0).cloneRange();
        };
        body.addEventListener('keyup', remember);
        body.addEventListener('mouseup', remember);
        body.addEventListener('blur', remember);
        const open = (event) => {
            event.preventDefault();
            remember();
            panel.open({ anchor: button, body, root: found.root, range: () => saved });
        };
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', open);
        button.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') open(event); });

        const cell = el('td', { style: { paddingLeft: '0', verticalAlign: 'middle' } }, button);
        if (found.send?.parentElement === found.row) found.send.after(cell);
        else found.row.append(cell);
    }

    /** Puts the thumbnail and a text link at the remembered cursor, or at the top of the message. */
    function insertVideo({ body, range, url, thumbnail, title, durationMs }) {
        // Inline styles only: they're what survives in email clients.
        const block = el('div', {},
            el('a', { href: url, target: '_blank', rel: 'noopener' },
                el('img', { src: thumbnail, alt: `▶ Watch “${title}” (${clock(durationMs)})`, width: 480, style: { width: '480px', maxWidth: '100%', height: 'auto', border: '0', borderRadius: '14px', display: 'block' } })),
        );
        const link = el('div', { style: { marginTop: '12px' } },
            el('a', { href: url, target: '_blank', rel: 'noopener', style: { display: 'inline-block', padding: '11px 20px', borderRadius: '999px', background: '#14121F', color: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', fontWeight: '700', lineHeight: '1', textDecoration: 'none' } },
                `▶  Watch the video · ${clock(durationMs)}`));
        const after = el('div', {}, el('br'));
        const fragment = document.createDocumentFragment();

        body.focus();
        let target = range();
        if (!target || !body.contains(target.startContainer)) {
            target = document.createRange();
            target.setStart(body, 0);
            target.collapse(true);
        }
        // A blank line above the video unless it goes at the very top.
        const before = document.createRange();
        before.setStart(body, 0);
        before.setEnd(target.startContainer, target.startOffset);
        if (before.toString().trim()) fragment.append(el('div', {}, el('br')));
        fragment.append(block, link, after);
        target.deleteContents();
        target.insertNode(fragment);
        const caret = document.createRange();
        caret.setStart(after, 0);
        caret.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(caret);
        // Lets Gmail know the draft changed, so it's saved.
        body.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    }

    /* ---------------------------------- panel ---------------------------------- */

    const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; z-index: 2147483000; width: 380px; max-width: calc(100vw - 24px); max-height: min(560px, calc(100vh - 24px)); display: flex; flex-direction: column; overflow: hidden;
  background: #fff; color: #14121F; border: 1px solid rgba(20,18,31,.1); border-radius: 18px; box-shadow: 0 24px 60px -20px rgba(20,18,31,.45);
  font: 14px/1.4 "Google Sans", Roboto, system-ui, sans-serif; }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px 16px; }
.head h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 700; }
button { font: inherit; color: inherit; }
.icon-btn { display: flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: rgba(20,18,31,.55); cursor: pointer; }
.icon-btn:hover { background: rgba(20,18,31,.06); color: #14121F; }
:focus-visible { outline: 2px solid #6A4CFF; outline-offset: 2px; }
.controls { display: grid; gap: 8px; padding: 0 14px 10px; }
label.field { display: grid; gap: 4px; font-size: 12px; font-weight: 600; color: rgba(20,18,31,.55); }
select, input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid rgba(20,18,31,.14); border-radius: 10px; background: #F7F6FB; font: inherit; color: #14121F; outline: none; }
select:focus, input:focus { border-color: #6A4CFF; background: #fff; }
.search { position: relative; }
.search svg { position: absolute; left: 10px; top: 9px; color: rgba(20,18,31,.4); }
.search input { padding-left: 32px; }
.hint { margin: 0; font-size: 12px; color: rgba(20,18,31,.5); }
.list { flex: 1; min-height: 120px; overflow-y: auto; padding: 4px 8px 8px; border-top: 1px solid rgba(20,18,31,.07); }
.item { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px; border: 0; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; }
.item:hover { background: #F7F6FB; }
.item[disabled] { opacity: .5; cursor: progress; }
.thumb { position: relative; flex: none; width: 88px; height: 50px; overflow: hidden; border-radius: 8px; background: linear-gradient(135deg,#1B1730,#3b2d8f); }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb span { position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 5px; background: rgba(0,0,0,.65); color: #fff; font-size: 11px; font-weight: 600; }
.meta { min-width: 0; flex: 1; }
.title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.sub { display: block; font-size: 12px; color: rgba(20,18,31,.5); }
.state { padding: 28px 18px; text-align: center; color: rgba(20,18,31,.6); }
.state strong { display: block; margin-bottom: 4px; color: #14121F; font-size: 15px; }
.primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; margin-top: 12px; padding: 0 16px; border: 0; border-radius: 10px; background: #14121F; color: #fff; font-weight: 600; cursor: pointer; }
.primary:hover { background: #2c2742; }
.link { border: 0; background: none; padding: 0; color: #5B3DF5; font-weight: 600; cursor: pointer; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-top: 1px solid rgba(20,18,31,.07); background: #FBFAFE; font-size: 13px; }
.foot button { display: inline-flex; align-items: center; gap: 6px; }
.error { margin: 0 14px 10px; padding: 8px 10px; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-size: 13px; }
.spin { width: 22px; height: 22px; margin: 0 auto 10px; border: 2.5px solid rgba(106,76,255,.2); border-top-color: #6A4CFF; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
`;

    const panel = (() => {
        let host = null;
        let shadow = null;
        let context = null;
        let videos = null;
        let origin = 'https://www.cliprame.com';

        const ensure = () => {
            if (host?.isConnected) return;
            host = el('div', { 'data-cliprame-panel': '' });
            shadow = host.attachShadow({ mode: 'closed' });
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(STYLES);
            shadow.adoptedStyleSheets = [sheet];
            document.body.append(host);
            // Clicking the Video button again is handled by open(), which toggles.
            document.addEventListener('mousedown', (event) => {
                const path = event.composedPath();
                if (context && !path.includes(host) && !path.includes(context.anchor)) close();
            }, true);
            document.addEventListener('keydown', (event) => { if (context && event.key === 'Escape') { event.stopPropagation(); close(); } }, true);
        };

        const close = () => {
            if (!context) return;
            const { anchor } = context;
            context = null;
            shadow?.replaceChildren();
            anchor?.focus?.();
        };

        const place = (box) => {
            const rect = context.anchor.getBoundingClientRect();
            const width = Math.min(380, window.innerWidth - 24);
            box.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
            // Above the button when there's room (compose windows sit at the bottom), else below.
            if (rect.top > 360) box.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
            else box.style.top = `${rect.bottom + 8}px`;
        };

        const openTab = (path) => void ask('open-cliprame', { path });

        const render = ({ state, error, filter = '' } = {}) => {
            if (!context) return;
            const recipients = recipientsIn(context.root);
            const box = el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Insert a Cliprame video' });

            const header = el('div', { class: 'head' },
                logo(26),
                el('h2', {}, 'Insert a video'),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon(ICONS.close, 16)),
            );
            box.append(header);

            if (state === 'loading') {
                box.append(el('div', { class: 'state', role: 'status' }, el('div', { class: 'spin' }), 'Loading your videos…'));
            } else if (state === 'signed-out') {
                box.append(el('div', { class: 'state' },
                    el('strong', {}, 'Sign in to Cliprame'),
                    'Then come back here and try again.',
                    el('div', {},
                        el('button', { class: 'primary', type: 'button', onclick: () => openTab('/login?next=/studio/videos') }, 'Sign in', icon(ICONS.external, 14))),
                    el('div', { style: { marginTop: '10px' } }, el('button', { class: 'link', type: 'button', onclick: () => load() }, 'I’ve signed in, try again')),
                ));
            } else if (state === 'error') {
                box.append(el('div', { class: 'state' },
                    el('strong', {}, 'Couldn’t load your videos'),
                    error || 'Check your connection and try again.',
                    el('div', {}, el('button', { class: 'primary', type: 'button', onclick: () => load() }, 'Try again')),
                ));
            } else {
                const select = el('select', { id: 'cliprame-recipient' },
                    ...recipients.map((person, index) => el('option', { value: String(index) }, person.name ? `${person.name} (${person.email})` : person.email)),
                    el('option', { value: 'none' }, recipients.length ? 'Anyone with the link (not personal)' : 'Anyone with the link'),
                );
                const search = el('input', { type: 'search', placeholder: 'Search your videos', value: filter, 'aria-label': 'Search your videos' });
                box.append(el('div', { class: 'controls' },
                    el('label', { class: 'field' }, 'Personal link for', select),
                    el('p', { class: 'hint' }, recipients.length
                        ? 'Their name shows on the video page, and their views are credited to them.'
                        : 'Add someone in the To field first to make a personal link.'),
                    el('div', { class: 'search' }, icon(ICONS.search, 16), search),
                ));
                if (error) box.append(el('p', { class: 'error', role: 'alert' }, error));

                const list = el('div', { class: 'list' });
                const fill = () => {
                    const needle = search.value.trim().toLowerCase();
                    const shown = (videos ?? []).filter((video) => !needle || video.title.toLowerCase().includes(needle));
                    list.replaceChildren(...(shown.length ? shown.map((video) => {
                        const image = video.posterUrl ? el('img', { src: video.posterUrl, alt: '', loading: 'lazy' }) : null;
                        image?.addEventListener('error', () => image.remove());
                        const views = video.views ? `${video.views} ${video.views === 1 ? 'view' : 'views'}` : 'No views yet';
                        return el('button', { class: 'item', type: 'button', 'aria-label': `${video.title}, ${clock(video.durationMs)}, ${views}`, onclick: (event) => choose(video, select.value === 'none' ? null : recipients[Number(select.value)], event.currentTarget, search.value) },
                            el('span', { class: 'thumb' }, image, el('span', {}, clock(video.durationMs))),
                            el('span', { class: 'meta' },
                                el('span', { class: 'title' }, video.title),
                                el('span', { class: 'sub' }, views)),
                        );
                    }) : [el('div', { class: 'state' }, videos?.length ? 'No videos match that search.' : el('span', {}, el('strong', {}, 'No videos yet'), 'Record one in Cliprame, then insert it here.'))]));
                };
                search.addEventListener('input', fill);
                fill();
                box.append(list);
                setTimeout(() => (videos?.length ? search : select).focus(), 0);
            }

            box.append(el('div', { class: 'foot' },
                el('button', { class: 'link', type: 'button', onclick: () => openTab('/studio?create=record') }, icon(ICONS.record, 14), 'Record a new video'),
                el('button', { class: 'link', type: 'button', onclick: () => openTab('/studio/videos'), style: { color: 'rgba(20,18,31,.55)' } }, 'Open Cliprame', icon(ICONS.external, 13)),
            ));

            shadow.replaceChildren(box);
            place(box);
        };

        const load = async () => {
            render({ state: 'loading' });
            const response = await ask('gmail-videos');
            if (!context) return;
            if (!response.ok) return render({ state: 'error', error: response.error });
            origin = response.value.origin ?? origin;
            if (response.value.signedOut) return render({ state: 'signed-out' });
            // Only finished videos have a link to send.
            videos = (response.value.videos ?? []).filter((video) => video.status === 'ready' && video.defaultSlug);
            render();
        };

        const choose = async (video, recipient, item, filter) => {
            if (!context) return;
            item.disabled = true;
            item.querySelector('.sub').textContent = recipient ? 'Making a personal link…' : 'Inserting…';
            let slug = video.defaultSlug;
            if (recipient) {
                const response = await ask('gmail-link', { videoId: video.id, recipientName: recipient.name, recipientEmail: recipient.email });
                if (!context) return;
                if (response.ok && response.value?.signedOut) return render({ state: 'signed-out' });
                if (!response.ok || !response.value?.link?.slug) {
                    // Members can't add links to a teammate's video; the shared link still works.
                    return render({ filter, error: `${response.error || 'Couldn’t make a personal link.'} Choose “Anyone with the link” to insert the shared link instead.` });
                }
                slug = response.value.link.slug;
            }
            const { body, range } = context;
            insertVideo({ body, range, url: `${origin}/v/${slug}`, thumbnail: `${origin}/v/${slug}/thumbnail`, title: video.title, durationMs: video.durationMs });
            close();
        };

        return {
            open(next) {
                ensure();
                if (context?.anchor === next.anchor) return close();
                context = next;
                if (videos) render();
                else void load();
                // Refresh in the background so new recordings show up.
                if (videos) void ask('gmail-videos').then((response) => {
                    if (response.ok && !response.value.signedOut && context === next) {
                        videos = (response.value.videos ?? []).filter((video) => video.status === 'ready' && video.defaultSlug);
                        origin = response.value.origin ?? origin;
                    }
                });
            },
        };
    })();

    /* ---------------------------------- watch ---------------------------------- */

    // Gmail builds compose windows on the fly; look for new message bodies as the page changes.
    let queued = false;
    const scan = () => {
        queued = false;
        for (const body of document.querySelectorAll('div[contenteditable="true"][g_editable="true"]:not([' + ATTACHED + '])')) attach(body);
    };
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        setTimeout(scan, 250);
    }).observe(document.documentElement, { childList: true, subtree: true });
    scan();
})();
