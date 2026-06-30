'use client';
import { useSyncExternalStore } from 'react';

export type QualityTier = 'high' | 'low';
interface Signals { coarsePointer?: boolean; cores?: number; deviceMemory?: number }

/** Pure, testable tier decision. Conservative: unknown → low. */
export function tierFor(s: Signals): QualityTier {
  if ((s.deviceMemory ?? 0) > 0 && (s.deviceMemory as number) < 4) return 'low';
  if (s.coarsePointer) return 'low';
  if ((s.cores ?? 0) >= 8 && !s.coarsePointer) return 'high';
  return 'low';
}

function read(): QualityTier {
  if (typeof window === 'undefined' || !window.matchMedia) return 'low';
  return tierFor({
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    cores: navigator.hardwareConcurrency,
    // deviceMemory is non-standard; guard it.
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
}

// Static after mount (device class doesn't change); server snapshot = low (safe, matches mobile-first).
export function useQualityTier(): QualityTier {
  return useSyncExternalStore(() => () => {}, read, () => 'low');
}
