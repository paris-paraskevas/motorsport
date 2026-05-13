export interface SeriesMeta {
  slug: string;
  name: string;
  color: string;
  icsUrl: string;
  season: number;
}

export type SignificanceTier = 'marquee' | 'finale' | 'weighted' | 'note';

export interface SignificanceFlag {
  tier: SignificanceTier;
  note: string;
}

export type SignificanceMap = Record<string, SignificanceFlag>;

export interface Session {
  uid: string;
  seriesSlug: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  significance?: SignificanceFlag;
}

export interface Series {
  meta: SeriesMeta;
  sessions: Session[];
  overview: string;
  drivers: string;
  significance: string;
  fetchedAt: Date;
  stale: boolean;
  configured: boolean;
}
