'use client';

import { useEffect } from 'react';

// Installed-PWA users must never see the marketing landing: the app IS their
// workstation. New installs launch at /app via manifest start_url; this guard
// covers existing installs whose cached manifest still points at "/", plus
// any in-app navigation that lands on the marketing root.
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari exposes navigator.standalone instead of the media query.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      window.location.replace('/app');
    }
  }, []);

  return null;
}
