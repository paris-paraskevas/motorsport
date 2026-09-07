import { afterEach, describe, expect, it } from 'vitest';
import { isProductionWorker } from './env';

describe('isProductionWorker', () => {
  const original = process.env.PADDOCK_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.PADDOCK_ENV;
    else process.env.PADDOCK_ENV = original;
  });

  it('is true for the exact value "production"', () => {
    process.env.PADDOCK_ENV = 'production';
    expect(isProductionWorker()).toBe(true);
  });

  it('is false when the variable is unset: every preview Worker, and local dev', () => {
    delete process.env.PADDOCK_ENV;
    expect(isProductionWorker()).toBe(false);
  });

  it('is false for near-misses, so a typo cannot unlock design writes', () => {
    for (const value of ['prod', 'Production', 'production ', '1', 'true', '']) {
      process.env.PADDOCK_ENV = value;
      expect(isProductionWorker(), JSON.stringify(value)).toBe(false);
    }
  });
});
