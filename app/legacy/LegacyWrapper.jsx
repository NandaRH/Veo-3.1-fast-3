'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { legacyMarkup } from './markup';
import { initLegacyApp } from './app';
import { supabase } from '../lib/supabaseClient';

const VALID_MODES = new Set(['single', 'batch', 'director', 'frame']);

const normalizeMode = (mode) => (VALID_MODES.has(mode) ? mode : 'single');

export default function LegacyWrapper({ initialMode = 'single' }) {
  const containerRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          try { router.push('/login'); } catch (_) { window.location.href = '/login'; }
        }
      } catch (_) {}
    })();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    try { document.body.classList.remove('app-locked'); } catch (_) {}
    try { const ov = document.getElementById('appLockOverlay'); if (ov) ov.style.display = 'none'; } catch (_) {}
    const container = containerRef.current;
    if (!container) return;

    const cleanupFns = [];
    const normalized = normalizeMode(initialMode);
    container.innerHTML = legacyMarkup;
    const card = container.querySelector('.card');
    if (card) card.dataset.initialMode = normalized;

    try {
      const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )plan=([^;]+)/) : null;
      const planCookie = (m && m[1] ? decodeURIComponent(m[1]) : '').toLowerCase();
      if (planCookie === 'free') {
        try { document.body.classList.add('free-locked'); } catch (_) {}
      } else {
        try { document.body.classList.remove('free-locked'); } catch (_) {}
      }
      if (planCookie === 'veo_lifetime') {
        const soraBtn = container.querySelector('#sora2Button');
        if (soraBtn) {
          try { soraBtn.setAttribute('aria-disabled', 'true'); } catch (_) {}
          try { soraBtn.style.opacity = '0.5'; } catch (_) {}
          try { soraBtn.style.pointerEvents = 'none'; } catch (_) {}
        }
      }
    } catch (_) {}

    // Mode frame tidak lagi membatasi rasio; biarkan 16:9 dan 9:16 tersedia.

    const applyInitialMode = (mode) => {
      const singleBtn = container.querySelector('#modeSingleBtn');
      const batchBtn = container.querySelector('#modeBatchBtn');
      const directorBtn = container.querySelector('#modeDirectorBtn');
      const singleSection = container.querySelector('#modeSingle');
      const batchSection = container.querySelector('#modeBatch');
      const directorSection = container.querySelector('#modeDirector');
      const frameBtn = container.querySelector('#modeFrameBtn');
      const frameSection = container.querySelector('#modeFrame');

      const setActive = (element, isActive) => {
        if (!element) return;
        element.classList.toggle('active', !!isActive);
        if (isActive) {
          element.setAttribute('aria-current', 'page');
        } else {
          element.removeAttribute('aria-current');
        }
      };

      setActive(singleBtn, mode === 'single');
      setActive(batchBtn, mode === 'batch');
      setActive(directorBtn, mode === 'director');
      setActive(frameBtn, mode === 'frame');

      if (singleSection) singleSection.style.display = mode === 'single' ? '' : 'none';
      if (batchSection) batchSection.style.display = mode === 'batch' ? '' : 'none';
      if (directorSection) directorSection.style.display = mode === 'director' ? '' : 'none';
      if (frameSection) frameSection.style.display = mode === 'frame' ? '' : 'none';
    };

    const attachSpaNavigation = (selector) => {
      const link = container.querySelector(selector);
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        try {
          router.prefetch(href);
        } catch {
          // swallow prefetch issues silently
        }
      }

      const handleClick = (event) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        const targetHref = link.getAttribute('href');
        if (!targetHref || !targetHref.startsWith('/')) {
          return;
        }

        if (targetHref === pathname) {
          return;
        }
        try {
          router.push(targetHref);
        } catch (_) {
          try { window.location.assign(targetHref); } catch {}
        }
      };

      link.addEventListener('click', handleClick);
      cleanupFns.push(() => link.removeEventListener('click', handleClick));
    };

    applyInitialMode(normalized);

    // Navigation handled by native anchors; prefetch keeps fast transitions
    // (no click interception to avoid conflicts)

    initLegacyApp({ initialMode: normalized });

    // Optional: buka modal settings jika ada query ?openSettings=1
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      if (params && params.get('openSettings') === '1') {
        if (typeof window !== 'undefined' && typeof window.__legacyOpenSettings === 'function') {
          window.__legacyOpenSettings();
        }
      }
    } catch {}

    return () => {
      cleanupFns.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // ignore individual cleanup failures
        }
      });
      if (typeof window !== 'undefined' && typeof window.__legacyCleanup === 'function') {
        try {
          window.__legacyCleanup();
        } catch {
          // ignore cleanup issues from legacy script
        }
      }
      if (container) {
        container.innerHTML = '';
      }
      try { document.body.classList.remove('free-locked'); } catch (_) {}
    };
  }, [initialMode, router, pathname]);

  return <div ref={containerRef} />;
}
