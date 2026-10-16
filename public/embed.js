/*!
 * Cliprame embed: https://www.cliprame.com
 *
 * <div class="cliprame-embed" data-video="LINK_CODE"></div>
 * <script src="https://www.cliprame.com/embed.js" async></script>
 *
 * Options (data attributes on the div):
 *   data-mode="inline" (default) or "popup"
 *   data-label="Watch the demo"      popup button text
 *   data-radius="12"                 corner radius in pixels
 *
 * For pages that add videos later (single-page apps), call window.Cliprame.scan().
 */
(function () {
    'use strict';
    if (window.Cliprame && window.Cliprame.__ready) {
        window.Cliprame.scan();
        return;
    }

    var script = document.currentScript;
    var BASE = script && script.src ? new URL(script.src).origin : 'https://www.cliprame.com';
    var frames = {}; // link code -> elements to resize when the player reports its shape
    var lastFocus = null;

    function css(node, styles) {
        for (var key in styles) node.style[key] = styles[key];
        return node;
    }

    function playIcon(size) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z');
        path.setAttribute('fill', 'currentColor');
        svg.appendChild(path);
        return svg;
    }

    function player(code, autoplay) {
        var frame = document.createElement('iframe');
        frame.src = BASE + '/embed/' + encodeURIComponent(code) + (autoplay ? '?autoplay=1' : '');
        frame.title = 'Cliprame video';
        frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        frame.setAttribute('allowfullscreen', '');
        if (!autoplay) frame.loading = 'lazy';
        return css(frame, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' });
    }

    function remember(code, node) {
        (frames[code] = frames[code] || []).push(node);
    }

    function inline(host, code) {
        var radius = (parseInt(host.getAttribute('data-radius'), 10) || 12) + 'px';
        var box = css(document.createElement('div'), {
            position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: radius,
            overflow: 'hidden', background: '#0B0A10',
        });
        box.appendChild(player(code, false));
        host.appendChild(box);
        remember(code, box);
    }

    function popupButton(host, code) {
        var button = css(document.createElement('button'), {
            display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 20px 12px 14px',
            border: '0', borderRadius: '999px', background: '#6A4CFF', color: '#fff', cursor: 'pointer',
            font: '600 15px/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            boxShadow: '0 12px 28px -12px rgba(106,76,255,0.9)',
        });
        button.type = 'button';
        var circle = css(document.createElement('span'), {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px',
            borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
        });
        circle.appendChild(playIcon(14));
        button.appendChild(circle);
        button.appendChild(document.createTextNode(host.getAttribute('data-label') || 'Watch video'));
        button.addEventListener('click', function () { openPopup(code); });
        host.appendChild(button);
    }

    function openPopup(code) {
        lastFocus = document.activeElement;
        var overlay = css(document.createElement('div'), {
            position: 'fixed', inset: '0', zIndex: '2147483647', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '24px', background: 'rgba(11,10,16,0.78)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        });
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Video');

        var box = css(document.createElement('div'), {
            position: 'relative', width: 'min(100%, 1100px, calc((100vh - 96px) * 16 / 9))', aspectRatio: '16 / 9',
            borderRadius: '16px', overflow: 'hidden', background: '#0B0A10', boxShadow: '0 40px 120px -30px rgba(0,0,0,0.7)',
        });
        box.setAttribute('data-cliprame-popup', '');
        box.appendChild(player(code, true));
        remember(code, box);

        var close = css(document.createElement('button'), {
            position: 'absolute', top: '16px', right: '16px', width: '40px', height: '40px', border: '0',
            borderRadius: '50%', background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer',
            font: '600 22px/1 ui-sans-serif, sans-serif',
        });
        close.type = 'button';
        close.setAttribute('aria-label', 'Close video');
        close.textContent = '×';

        var previousOverflow = document.documentElement.style.overflow;
        function shut() {
            document.removeEventListener('keydown', onKey, true);
            frames[code] = (frames[code] || []).filter(function (node) { return node !== box; });
            overlay.remove();
            document.documentElement.style.overflow = previousOverflow;
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
        function onKey(event) { if (event.key === 'Escape') shut(); }

        close.addEventListener('click', shut);
        overlay.addEventListener('click', function (event) { if (event.target === overlay) shut(); });
        document.addEventListener('keydown', onKey, true);

        overlay.appendChild(box);
        overlay.appendChild(close);
        document.body.appendChild(overlay);
        document.documentElement.style.overflow = 'hidden';
        close.focus();
    }

    function scan() {
        var nodes = document.querySelectorAll('.cliprame-embed[data-video]:not([data-cliprame-ready])');
        for (var i = 0; i < nodes.length; i += 1) {
            var host = nodes[i];
            var code = host.getAttribute('data-video');
            if (!/^[A-Za-z0-9_-]{10,32}$/.test(code)) continue;
            host.setAttribute('data-cliprame-ready', '');
            if (host.getAttribute('data-mode') === 'popup') popupButton(host, code);
            else inline(host, code);
        }
    }

    // The player reports the video's shape so portrait and square videos fit.
    window.addEventListener('message', function (event) {
        if (event.origin !== BASE || !event.data || event.data.type !== 'cliprame:resize') return;
        var ratio = Number(event.data.ratio);
        if (!(ratio > 0.2 && ratio < 5)) return;
        (frames[event.data.slug] || []).forEach(function (node) {
            node.style.aspectRatio = String(ratio);
            if (node.hasAttribute('data-cliprame-popup')) {
                node.style.width = 'min(100%, 1100px, calc((100vh - 96px) * ' + ratio + '))';
            } else if (ratio < 1) {
                node.style.maxWidth = 'min(100%, ' + Math.round(ratio * 720) + 'px)';
                node.style.margin = '0 auto';
            }
        });
    });

    window.Cliprame = { scan: scan, __ready: true };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
    else scan();
})();
