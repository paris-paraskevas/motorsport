'use client';

import { useEffect } from 'react';

// Installed-PWA LAUNCHES at "/" go to the workstation: new installs start at
// /app via manifest start_url; this guard covers existing installs whose
// cached manifest still points at "/" (and notification clicks that open "/").
// Deliberate in-app navigation to the landing (the footer "Landing" link) is
// allowed through — a launch has no referrer, an in-app click has a
// same-origin one (cross-root-layout navigation is a full page load, so the
// referrer is real). Operator-reported 0.19.2: the unconditional redirect
// made the landing unreachable from inside the PWA.
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari exposes navigator.standalone instead of the media query.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const cameFromApp =
      document.referrer !== '' && document.referrer.startsWith(window.location.origin);
    if (!cameFromApp) {
      window.location.replace('/app');
    }
  }, []);

  return null;
}
