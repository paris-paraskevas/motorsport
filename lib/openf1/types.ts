// OpenF1 API response types (api.openf1.org/v1), verified against openf1.org
// docs 2026-06-28. Every endpoint returns a JSON array of these rows. Fields
// are widened to `| null` where OpenF1 omits/null them mid-session or for
// non-applicable session types (e.g. sector durations on an out-lap).
//
// Licensing: OpenF1 data is CC BY-NC-SA 4.0 — attribution + non-commercial.
// The underlying timing data is Formula One Management's; OpenF1 is unofficial.
// Surface the attribution + "not affiliated with F1" disclaimer wherever this
// data renders (see components/f1/OpenF1Attribution).

/** A practice/qualifying/race/sprint session within a meeting (GP weekend). */
export interface OF1Session {
  session_key: number;
  session_name: string; // "Practice 1" | "Qualifying" | "Sprint" | "Sprint Qualifying" | "Race"
  session_type: string; // "Practice" | "Qualifying" | "Race"
  date_start: string; // ISO
  date_end: string; // ISO
  gmt_offset?: string; // "+02:00"
  location: string;
  circuit_key?: number;
  circuit_short_name: string;
  country_name?: string;
  meeting_key: number;
  year: number;
}

/** A GP weekend / test event. */
export interface OF1Meeting {
  meeting_key: number;
  meeting_name: string; // "Italian Grand Prix"
  meeting_official_name?: string;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
  location: string;
  date_start: string; // ISO
  year: number;
}

/** Per-session driver metadata. `team_colour` is hex WITHOUT a leading '#'. */
export interface OF1Driver {
  driver_number: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  broadcast_name?: string; // "M VERSTAPPEN"
  name_acronym: string; // "VER"
  team_name: string;
  team_colour: string; // "3671C6" (no '#')
  headshot_url?: string; // F1 CDN image
  session_key: number;
  meeting_key: number;
}

/**
 * One timed lap. `segments_sector_*` are arrays of minisector status codes
 * (2048 unknown, 2049 yellow, 2050 green, 2051 purple/overall-best, etc.) used
 * for the dominance map. Speeds in km/h; durations in seconds.
 */
export interface OF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null; // intermediate 1 speed trap
  i2_speed: number | null; // intermediate 2 speed trap
  st_speed: number | null; // speed-trap (straight) speed
  is_pit_out_lap: boolean;
  date_start: string | null; // ISO — lap start, the join key into car_data/location
  segments_sector_1: number[] | null;
  segments_sector_2: number[] | null;
  segments_sector_3: number[] | null;
  session_key: number;
}

/** Telemetry sample (~3.7 Hz). `drs` is a coded value; `brake`/`throttle` 0-100. */
export interface OF1CarData {
  driver_number: number;
  date: string; // ISO
  speed: number; // km/h
  throttle: number; // 0-100
  brake: number; // 0 or 100
  n_gear: number; // 0-8
  rpm: number;
  drs: number; // coded (0/1/8 off, 10/12/14 on, etc.)
  session_key: number;
}

/** Car position sample (~3.7 Hz). Planar x/y self-draw the circuit; z = elevation. */
export interface OF1Location {
  driver_number: number;
  date: string; // ISO
  x: number;
  y: number;
  z: number;
  session_key: number;
}

/** Gap data during a race (~4 s). Strings like "+1 LAP" appear for lapped cars. */
export interface OF1Interval {
  driver_number: number;
  date: string; // ISO
  gap_to_leader: number | string | null;
  interval: number | string | null; // gap to car ahead
  session_key: number;
}

/** Track position over time. */
export interface OF1Position {
  driver_number: number;
  date: string; // ISO
  position: number;
  session_key: number;
}

/** A continuous tyre stint. */
export interface OF1Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string | null; // "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET"
  tyre_age_at_start: number | null;
  session_key: number;
}

/** A pit stop. `pit_duration` is deprecated (removed end-2026); prefer lane/stop. */
export interface OF1Pit {
  driver_number: number;
  date: string; // ISO
  lap_number: number;
  pit_duration?: number | null;
  lane_duration?: number | null;
  stop_duration?: number | null;
  session_key: number;
}

/** Race-control message: flags, safety car, DRS enable, incidents, penalties. */
export interface OF1RaceControl {
  date: string; // ISO
  category: string; // "Flag" | "SafetyCar" | "Drs" | "CarEvent" | "Other"
  flag: string | null; // "GREEN" | "YELLOW" | "DOUBLE YELLOW" | "RED" | "BLUE" | "CHEQUERED" | "CLEAR"
  scope: string | null; // "Track" | "Sector" | "Driver"
  sector: number | null;
  message: string;
  driver_number: number | null;
  lap_number: number | null;
  session_key: number;
}

/** Team-radio clip. `recording_url` is an mp3 on F1's CDN. Sparse in 2026. */
export interface OF1TeamRadio {
  driver_number: number;
  date: string; // ISO
  recording_url: string;
  session_key: number;
}

/** An overtake event (races only; OpenF1 notes coverage may be incomplete). */
export interface OF1Overtake {
  date: string; // ISO
  overtaking_driver_number: number;
  overtaken_driver_number: number;
  position: number;
  session_key: number;
}

/**
 * Final session classification. `duration`/`gap_to_leader` are [Q1,Q2,Q3]
 * arrays for qualifying, scalars for race/practice.
 */
export interface OF1SessionResult {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | Array<number | null> | null;
  gap_to_leader: number | string | Array<number | null> | null;
  points?: number;
  session_key: number;
}

/** Starting grid (from qualifying). */
export interface OF1StartingGrid {
  driver_number: number;
  position: number;
  lap_duration: number | null;
  session_key: number;
}

/** Track conditions (updated each minute). */
export interface OF1Weather {
  date: string; // ISO
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_direction: number;
  wind_speed: number;
  session_key: number;
}
