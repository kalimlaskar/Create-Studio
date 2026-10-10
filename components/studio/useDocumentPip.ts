'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const subscribeNoop = () => () => undefined;

type DocumentPipApi = {
    requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

const getApi = () =>
    typeof window === 'undefined'
        ? undefined
        : (window as unknown as { documentPictureInPicture?: DocumentPipApi }).documentPictureInPicture;

// Tailwind classes only work in the floating window if the page's CSS is copied in.
function copyStyles(target: Document) {
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            const css = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
            const style = target.createElement('style');
            style.textContent = css;
            target.head.appendChild(style);
        } catch {
            // Cross-origin sheet: link it instead of reading its rules.
            if (sheet.href) {
                const link = target.createElement('link');
                link.rel = 'stylesheet';
                link.href = sheet.href;
                target.head.appendChild(link);
            }
        }
    }
    // Keeps theme classes and next/font CSS variables (e.g. --font-display) working.
    target.documentElement.className = document.documentElement.className;
    target.body.className = document.body.className;
    target.body.style.margin = '0';
    target.body.style.background = '#14121F';
}

/**
 * Opens a Google-Meet-style always-on-top window (Document Picture-in-Picture).
 * open() must run inside a user gesture (a click handler).
 */
export function useDocumentPip(autoOpen = false) {
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const isSupported = useSyncExternalStore(subscribeNoop, () => Boolean(getApi()), () => false);
    const [error, setError] = useState<string | null>(null);
    const pipRef = useRef<Window | null>(null);

    const close = useCallback(() => {
        pipRef.current?.close();
        pipRef.current = null;
        setPipWindow(null);
    }, []);

    const open = useCallback(async (size = { width: 380, height: 640 }) => {
        const api = getApi();
        if (!api) {
            setError('This browser does not support the floating window. Use desktop Chrome or Edge 116+.');
            return false;
        }
        if (pipRef.current) return true;
        try {
            setError(null);
            const win = await api.requestWindow(size);
            copyStyles(win.document);
            win.addEventListener('pagehide', () => {
                pipRef.current = null;
                setPipWindow(null);
            });
            pipRef.current = win;
            setPipWindow(win);
            return true;
        } catch (err) {
            console.error('Floating window could not open:', err);
            setError(err instanceof Error ? `${err.name}: ${err.message}` : 'Floating window could not open.');
            return false;
        }
    }, []);

    // Meet-style: while autoOpen is true (screen sharing), Chrome opens the floating
    // window by itself the moment the user switches to another tab. No click needed.
    useEffect(() => {
        if (!autoOpen || !('mediaSession' in navigator)) return;
        const session = navigator.mediaSession as unknown as {
            setActionHandler: (action: string, handler: (() => void) | null) => void;
        };
        try {
            session.setActionHandler('enterpictureinpicture', () => {
                console.info('[pip] Chrome asked to enter picture-in-picture (tab switch)');
                void open();
            });
        } catch {
            return; // this Chrome version does not know the action
        }
        return () => {
            try { session.setActionHandler('enterpictureinpicture', null); } catch { }
        };
    }, [autoOpen, open]);

    useEffect(() => () => { pipRef.current?.close(); }, []);

    return { pipWindow, isOpen: pipWindow !== null, isSupported, error, open, close };
}