// ICS session titles often carry their own series prefix ("WEC - Le Mans
// Free Practice 1"). Next to an explicit series label that reads as a
// stutter ("FIA WEC WEC - …"), so drop a leading prefix whose token already
// appears in the series name.
export function cleanSessionTitle(seriesName: string, title: string): string {
  const m = title.match(/^([A-Za-z0-9 .]{1,14})\s*[-–—:]\s+(.+)$/);
  if (!m) return title;
  const prefix = m[1].trim().toUpperCase();
  if (prefix && seriesName.toUpperCase().includes(prefix)) return m[2];
  return title;
}
