import fs from 'fs/promises';
import path from 'path';
import { SeriesRoundsFile } from './types';

export async function loadRounds(dir: string): Promise<SeriesRoundsFile | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, 'rounds.json'), 'utf-8');
    const parsed = JSON.parse(raw) as SeriesRoundsFile;
    if (!parsed || !Array.isArray(parsed.rounds)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
