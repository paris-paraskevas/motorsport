// The feature switches (APEX: Build Options), by key, with a label, what each
// one switches in plain words, and whether the site honours it yet.
// Client-safe: the designer's editor lists them, the server loader
// (build-options.ts) falls back to them, and the gated components read the
// loader's answer.

export const BUILD_OPTION_KEYS = ['ghost_lap_3d', 'weather', 'social', 'studio'] as const;
export type BuildOptionKey = (typeof BUILD_OPTION_KEYS)[number];

export const BUILD_OPTION_STATUSES = ['include', 'exclude'] as const;
export type BuildOptionStatus = (typeof BUILD_OPTION_STATUSES)[number];

/** Every key resolved to a status; what the site renders from. */
export type BuildOptions = Record<BuildOptionKey, BuildOptionStatus>;

/** What each option switches, and whether the site honours it yet. An option
 *  that is not wired saves like the others; nothing reads it until the step
 *  that gates its feature, and its row says so. */
export const BUILD_OPTION_DEFAULTS: Record<BuildOptionKey, { label: string; switches: string; wired: boolean }> = {
  ghost_lap_3d: {
    label: 'Ghost lap 3D',
    switches:
      'The Onboard replay in the F1 qualifying analysis on a session page. Excluded: the 2D replay alone, and the 3D code is never downloaded.',
    wired: true,
  },
  weather: {
    label: 'Weather',
    switches:
      'The weather strip on a weekend page and the hours around a session on its own page. Excluded: both render nothing.',
    wired: true,
  },
  social: {
    label: 'Social',
    switches: 'Not wired yet: the setting is stored, and nothing changes until a later step gates the social features.',
    wired: false,
  },
  studio: {
    label: 'Studio',
    switches: 'Not wired yet: the setting is stored, and nothing changes until a later step gates the studio.',
    wired: false,
  },
};

/** Include everywhere: what the site does when it cannot read the rows. */
export const DEFAULT_BUILD_OPTIONS: BuildOptions = Object.fromEntries(
  BUILD_OPTION_KEYS.map(k => [k, 'include']),
) as BuildOptions;

export function isBuildOptionKey(key: string): key is BuildOptionKey {
  return (BUILD_OPTION_KEYS as readonly string[]).includes(key);
}

export function isBuildOptionStatus(value: unknown): value is BuildOptionStatus {
  return typeof value === 'string' && (BUILD_OPTION_STATUSES as readonly string[]).includes(value);
}
