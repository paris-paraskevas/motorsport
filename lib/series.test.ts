import { describe, it, expect } from 'vitest';
import path from 'path';
import { loadSeriesFromDir } from './series';

const FIXTURE_DIR = path.join(__dirname, '..', 'tests', 'fixtures', 'series-test');

describe('loadSeriesFromDir', () => {
  it('loads meta and marks configured=false when icsUrl is empty', async () => {
    const series = await loadSeriesFromDir(FIXTURE_DIR);
    expect(series.meta.slug).toBe('test');
    expect(series.meta.name).toBe('Test Series');
    expect(series.configured).toBe(false);
  });
  it('falls back to local ICS and marks stale=true when icsUrl empty', async () => {
    const series = await loadSeriesFromDir(FIXTURE_DIR);
    expect(series.sessions).toHaveLength(2);
    expect(series.stale).toBe(true);
  });
  it('returns empty-string HTML for placeholder markdown', async () => {
    const series = await loadSeriesFromDir(FIXTURE_DIR);
    expect(series.overview).toBe('');
    expect(series.drivers).toBe('');
    expect(series.significance).toBe('');
  });
});
