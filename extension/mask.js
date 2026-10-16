// Cliprame privacy masks. Runs inside sites the creator has turned masking on for.
//
// Masks are drawn by the page itself, so the private pixels never reach the tab
// capture:
//   - picked elements and form fields are covered by a stylesheet;
//   - text patterns and custom words are painted over with the CSS Custom
//     Highlight API, which styles text ranges without editing the page's DOM
//     (editing it would break apps like React).
// The page stays hidden until the first masks are applied, so nothing leaks on load.
(() => {
    if (window.__cliprameMask) return;
    window.__cliprameMask = true;

    const ORIGIN = location.origin;
    const RULES_KEY = `rules:${ORIGIN}`;
    const HIGHLIGHT_NAME = 'cliprame-mask';
    const MASK_COLOR = '#2B2838';
    const SOFT_MASK_COLOR = '#D9D6E3';
    const SKIP_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA']);
    const INPUTS = 'input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=range],[type=color],[type=file],[type=image],[type=hidden]),textarea,select';

    const DEFAULT_RULES = {
        selectors: [],
        patterns: { email: true, phone: true, card: true, apiKey: true, pan: false, aadhaar: false },
        words: [],
        style: 'block',
        maskInputs: false,
    };

    /* ----------------------------- patterns ---------------------------- */

    const digitsIn = (text) => text.replace(/\D/g, '').length;

    const luhn = (text) => {
        const digits = text.replace(/\D/g, '');
        let sum = 0;
        for (let i = 0; i < digits.length; i += 1) {
            let digit = Number(digits[digits.length - 1 - i]);
            if (i % 2) { digit *= 2; if (digit > 9) digit -= 9; }
            sum += digit;
        }
        return sum % 10 === 0;
    };

    const PATTERNS = {
        email: { regex: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi },
        card: { regex: /\b(?:\d[ -]?){12,18}\d\b/g, valid: (match) => digitsIn(match) >= 13 && luhn(match) },
        phone: { regex: /(?<![\w.])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{2,5}(?:[\s.-]?\d{2,5}){1,3}(?![\w.])/g, valid: (match) => { const count = digitsIn(match); return count >= 10 && count <= 13; } },
        aadhaar: { regex: /(?<!\d[ -]?)\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b(?![ -]?\d)/g },
        pan: { regex: /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g },
        apiKey: { regex: /\b(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g },
    };

    const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /* ------------------------------ state ------------------------------ */

    let rules = null;
    let matchers = [];
    let rangesByNode = new WeakMap();
    let observer = null;
    const highlight = typeof Highlight === 'function' && CSS.highlights ? new Highlight() : null;
    if (highlight) highlight.priority = 1000;

    const style = document.createElement('style');
    style.id = 'cliprame-mask-style';

    const attachStyle = () => {
        if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    };

    /* --------------------------- hide on load -------------------------- */

    const cover = document.createElement('style');
    cover.textContent = 'html{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(cover);
    const uncover = () => cover.remove();
    // Never leave a page hidden if something below fails.
    setTimeout(uncover, 1500);

    /* ------------------------------ styles ----------------------------- */

    const validSelector = (selector) => {
        try { document.createDocumentFragment().querySelector(selector); return true; } catch { return false; }
    };

    function buildCss() {
        const css = [];
        const block = `color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;background-image:none!important;background-color:${MASK_COLOR}!important;border-color:${MASK_COLOR}!important;caret-color:transparent!important;`;
        const list = rules.selectors.map((item) => item.selector).filter(validSelector).join(',');

        if (list) {
            if (rules.style === 'blur') {
                css.push(`:is(${list}){filter:blur(14px)!important}`);
            } else {
                css.push(`:is(${list}){${block}border-radius:4px!important}`);
                css.push(`:is(${list}) *{visibility:hidden!important}`);
                css.push(`:is(${list}):is(img,video,canvas,svg,picture,iframe,object,embed){filter:brightness(0)!important}`);
            }
        }
        if (rules.maskInputs) {
            css.push(rules.style === 'blur'
                ? `:is(${INPUTS}){filter:blur(9px)!important}`
                : `:is(${INPUTS}){${block}}:is(${INPUTS})::placeholder{color:#A8A3B8!important;-webkit-text-fill-color:#A8A3B8!important}`);
        }
        // Matched text is always covered solid: blurred short text like an email can still be read.
        const textColor = rules.style === 'blur' ? SOFT_MASK_COLOR : MASK_COLOR;
        css.push(`::highlight(${HIGHLIGHT_NAME}){color:${textColor};background-color:${textColor};text-shadow:none}`);
        return css.join('\n');
    }

    /* ------------------------------- text ------------------------------ */

    function buildMatchers() {
        const list = Object.entries(PATTERNS)
            .filter(([name]) => rules.patterns?.[name])
            .map(([, pattern]) => pattern);
        const words = (rules.words ?? []).map((word) => word.trim()).filter((word) => word.length >= 2);
        if (words.length) list.push({ regex: new RegExp(words.map(escapeRegex).join('|'), 'gi') });
        return list;
    }

    function clearNode(node) {
        const ranges = rangesByNode.get(node);
        if (!ranges) return;
        ranges.forEach((range) => highlight.delete(range));
        rangesByNode.delete(node);
    }

    function maskTextNode(node) {
        clearNode(node);
        const parent = node.parentElement;
        if (!node.isConnected || !parent || SKIP_PARENTS.has(parent.tagName)) return;
        const text = node.data;
        if (text.length < 3) return;

        const ranges = [];
        for (const { regex, valid } of matchers) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text))) {
                if (!match[0]) { regex.lastIndex += 1; continue; }
                if (valid && !valid(match[0])) continue;
                const range = new Range();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                highlight.add(range);
                ranges.push(range);
            }
        }
        if (ranges.length) rangesByNode.set(node, ranges);
    }

    function forEachTextNode(root, callback) {
        if (root.nodeType === Node.TEXT_NODE) { callback(root); return; }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) callback(node);
    }

    // MutationObserver callbacks run before the browser paints, so new text is
    // masked in the same frame it first appears.
    function onMutations(records) {
        attachStyle();
        if (!matchers.length || !highlight) return;
        for (const record of records) {
            if (record.type === 'characterData') {
                maskTextNode(record.target);
                continue;
            }
            record.removedNodes.forEach((node) => forEachTextNode(node, clearNode));
            record.addedNodes.forEach((node) => forEachTextNode(node, maskTextNode));
        }
    }

    /* ------------------------------ apply ------------------------------ */

    function apply() {
        style.textContent = buildCss();
        attachStyle();
        matchers = buildMatchers();
        if (highlight) {
            highlight.clear();
            rangesByNode = new WeakMap();
            if (matchers.length) {
                CSS.highlights.set(HIGHLIGHT_NAME, highlight);
                forEachTextNode(document, maskTextNode);
            } else {
                CSS.highlights.delete(HIGHLIGHT_NAME);
            }
        }
        if (!observer) {
            observer = new MutationObserver(onMutations);
            observer.observe(document, { subtree: true, childList: true, characterData: true });
        }
    }

    function teardown() {
        observer?.disconnect();
        observer = null;
        style.remove();
        highlight?.clear();
        CSS.highlights?.delete(HIGHLIGHT_NAME);
        rules = null;
    }

    async function load() {
        const stored = await chrome.storage.local.get([RULES_KEY, 'maskSites']);
        if (!(stored.maskSites ?? []).includes(ORIGIN)) {
            teardown();
            return;
        }
        rules = { ...DEFAULT_RULES, ...stored[RULES_KEY], patterns: { ...DEFAULT_RULES.patterns, ...stored[RULES_KEY]?.patterns } };
        apply();
    }

    load()
        .catch((error) => console.error('[cliprame] Could not apply masks:', error))
        .finally(uncover);

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes[RULES_KEY] || changes.maskSites)) void load();
    });

    /* ------------------------------ picker ----------------------------- */

    const STABLE_ATTRS = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'name', 'aria-label'];
    const stableId = (id) => id.length < 64 && !/\d{4,}/.test(id) && !id.includes(':');

    function selectorFor(element) {
        const parts = [];
        for (let node = element; node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement; node = node.parentElement) {
            if (node.id && stableId(node.id)) {
                const byId = `#${CSS.escape(node.id)}`;
                if (document.querySelectorAll(byId).length === 1) {
                    parts.unshift(byId);
                    return parts.join(' > ');
                }
            }
            const tag = node.localName;
            const attr = STABLE_ATTRS.find((name) => { const value = node.getAttribute(name); return value && value.length < 80; });
            let part = attr ? `${tag}[${attr}="${CSS.escape(node.getAttribute(attr))}"]` : tag;
            const siblings = node.parentElement ? [...node.parentElement.children].filter((child) => child.localName === tag) : [];
            if (siblings.length > 1 && (!attr || siblings.filter((child) => child.getAttribute(attr) === node.getAttribute(attr)).length > 1)) {
                part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
            }
            parts.unshift(part);
            const candidate = parts.join(' > ');
            if (document.querySelectorAll(candidate).length === 1) return candidate;
        }
        return parts.join(' > ');
    }

    // A short description for the popup list. It never includes the element's text,
    // which may be the private data itself.
    function labelFor(element) {
        const hint = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || element.getAttribute('role') || '';
        return hint ? `${element.localName} · ${hint.slice(0, 40)}` : element.localName;
    }

    async function toggleElement(element) {
        const stored = await chrome.storage.local.get(RULES_KEY);
        const current = { ...DEFAULT_RULES, ...stored[RULES_KEY] };
        const existing = current.selectors.find((item) => validSelector(item.selector) && element.closest(item.selector));
        const selectors = existing
            ? current.selectors.filter((item) => item !== existing)
            : [...current.selectors, { selector: selectorFor(element), label: labelFor(element) }];
        await chrome.storage.local.set({ [RULES_KEY]: { ...current, selectors } });
    }

    let picker = null;

    function startPicker() {
        if (picker || window !== window.top) return;
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
        const root = host.attachShadow({ mode: 'closed' });
        root.innerHTML = `
            <style>
                :host{all:initial}
                *{box-sizing:border-box;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
                .box{position:fixed;display:none;border-radius:6px;pointer-events:none;transition:left .08s,top .08s,width .08s,height .08s;box-shadow:0 0 0 2px #6A4CFF,0 0 0 6px rgba(106,76,255,.22);background:rgba(106,76,255,.1)}
                .box.unmask{box-shadow:0 0 0 2px #F43F5E,0 0 0 6px rgba(244,63,94,.22);background:rgba(244,63,94,.08)}
                .tag{position:fixed;display:none;padding:4px 8px;border-radius:7px;background:#6A4CFF;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;box-shadow:0 6px 16px -6px rgba(20,18,31,.5)}
                .tag.unmask{background:#F43F5E}
                .tag span{opacity:.75;font-weight:600;margin-left:6px}
                .bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;white-space:nowrap;max-width:calc(100vw - 24px);padding:8px 8px 8px 10px;border-radius:999px;background:rgba(20,18,31,.88);backdrop-filter:blur(12px) saturate(1.4);color:#fff;font-size:13px;font-weight:600;box-shadow:0 18px 40px -14px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.08);pointer-events:auto;animation:drop .25s cubic-bezier(.3,.7,.4,1.2)}
                .logo{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6A4CFF,#FF3D81)}
                .logo svg{width:15px;height:15px}
                .hint{color:rgba(255,255,255,.72);font-weight:500}
                kbd{padding:2px 6px;border-radius:5px;background:rgba(255,255,255,.12);font:inherit;font-size:11px;color:#fff}
                .count{padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.1);font-size:12px;font-variant-numeric:tabular-nums}
                button{border:0;border-radius:999px;padding:8px 16px;background:#fff;color:#14121F;font:inherit;font-weight:700;cursor:pointer}
                button:hover{background:#ECE9FF}
                button:focus-visible{outline:2px solid #8B74FF;outline-offset:2px}
                @keyframes drop{from{opacity:0;transform:translate(-50%,-8px)}}
                @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
            </style>
            <div class="box"></div>
            <div class="tag"></div>
            <div class="bar" role="toolbar" aria-label="Cliprame mask picker">
                <span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/></svg></span>
                <span class="hint">Click to hide or show · <kbd>Esc</kbd> to finish</span>
                <span class="count" aria-live="polite"></span>
                <button type="button">Done</button>
            </div>`;
        const box = root.querySelector('.box');
        const tag = root.querySelector('.tag');
        const bar = root.querySelector('.bar');
        const count = root.querySelector('.count');
        document.documentElement.appendChild(host);

        const renderCount = () => {
            const total = rules?.selectors.length ?? 0;
            count.textContent = `${total} hidden`;
        };
        renderCount();
        const onRulesChange = (changes, area) => { if (area === 'local' && changes[RULES_KEY]) setTimeout(() => { renderCount(); if (hovered) highlightTarget(hovered); }, 50); };
        chrome.storage.onChanged.addListener(onRulesChange);

        let hovered = null;
        const isMasked = (element) => Boolean(rules?.selectors.some((item) => validSelector(item.selector) && element.closest(item.selector)));
        const highlightTarget = (target) => {
            const rect = target.getBoundingClientRect();
            const unmask = isMasked(target);
            box.classList.toggle('unmask', unmask);
            tag.classList.toggle('unmask', unmask);
            Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
            tag.textContent = unmask ? 'Click to show' : 'Click to hide';
            const size = document.createElement('span');
            size.textContent = `${target.localName} · ${Math.round(rect.width)}×${Math.round(rect.height)}`;
            tag.append(size);
            tag.style.display = 'block';
            const above = rect.top > 34;
            tag.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - tag.offsetWidth - 4))}px`;
            tag.style.top = `${above ? rect.top - tag.offsetHeight - 6 : Math.min(rect.bottom + 6, window.innerHeight - tag.offsetHeight - 4)}px`;
        };
        const onMove = (event) => {
            const target = event.target;
            if (!(target instanceof Element) || target === host) return;
            hovered = target;
            highlightTarget(target);
        };
        const onClick = (event) => {
            if (event.composedPath().includes(bar)) return;
            event.preventDefault();
            event.stopPropagation();
            if (hovered) void toggleElement(hovered);
        };
        const block = (event) => {
            if (event.composedPath().includes(bar)) return;
            event.preventDefault();
            event.stopPropagation();
        };
        const onKey = (event) => { if (event.key === 'Escape') stopPicker(); };

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('mousedown', block, true);
        document.addEventListener('mouseup', block, true);
        document.addEventListener('keydown', onKey, true);
        root.querySelector('button').addEventListener('click', () => stopPicker());

        picker = () => {
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('mousedown', block, true);
            document.removeEventListener('mouseup', block, true);
            document.removeEventListener('keydown', onKey, true);
            chrome.storage.onChanged.removeListener(onRulesChange);
            host.remove();
        };
    }

    function stopPicker() {
        picker?.();
        picker = null;
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'cliprame-pick') {
            startPicker();
            sendResponse({ ok: true });
        }
        if (message?.type === 'cliprame-mask-status') {
            sendResponse({ ok: true, active: Boolean(rules), highlights: Boolean(highlight) });
        }
        return false;
    });
})();
