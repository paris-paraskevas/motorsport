// The FIA's three-letter nationality codes the curated champions carry (R18), and the country each names. Client-safe and
// dependency-free: the champions page's views draw the country from the code, and the champions integrity test holds every
// code a file uses to one listed here, so a typo never ships as a blank.
export const NATIONALITIES: Readonly<Record<string, string>> = {
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Belgium',
  BRA: 'Brazil',
  CAN: 'Canada',
  CHN: 'China',
  COL: 'Colombia',
  CZE: 'Czech Republic',
  DEN: 'Denmark',
  ESP: 'Spain',
  EST: 'Estonia',
  FIN: 'Finland',
  FRA: 'France',
  GBR: 'United Kingdom',
  GER: 'Germany',
  IND: 'India',
  INA: 'Indonesia',
  IRL: 'Ireland',
  ISR: 'Israel',
  ITA: 'Italy',
  JPN: 'Japan',
  MEX: 'Mexico',
  MON: 'Monaco',
  NED: 'Netherlands',
  NOR: 'Norway',
  NZL: 'New Zealand',
  POL: 'Poland',
  POR: 'Portugal',
  RUS: 'Russia',
  SUI: 'Switzerland',
  SWE: 'Sweden',
  THA: 'Thailand',
  USA: 'United States',
  VEN: 'Venezuela',
};

/** The country a code names, or null for a code the list lacks. */
export function countryName(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(NATIONALITIES, code) ? NATIONALITIES[code] : null;
}
