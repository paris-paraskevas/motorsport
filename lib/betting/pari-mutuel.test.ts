import { describe, it, expect } from 'vitest';
import { settlePool, type PoolBet } from './pari-mutuel';

const mk = (id: string, stake: number, won: boolean): PoolBet => ({ betId: id, userId: id, stake, won });
const find = (r: ReturnType<typeof settlePool>, id: string) => r.payouts.find(p => p.betId === id)!;

describe('settlePool (pari-mutuel)', () => {
  it('10-vs-1: the lone longshot backer takes the whole pool', () => {
    const bets = [
      ...Array.from({ length: 10 }, (_, i) => mk(`ham${i}`, 100, false)),
      mk('ver', 100, true),
    ];
    const r = settlePool(bets);
    expect(r.pool).toBe(1100);
    expect(find(r, 'ver')).toMatchObject({ outcome: 'won', payout: 1100 }); // stake + 10 losers'
    expect(r.payouts.filter(p => p.outcome === 'lost').every(p => p.payout === 0)).toBe(true);
    expect(r.remainder).toBe(0);
  });

  it('favourite wins: the many split the pool, each a small profit', () => {
    const bets = [
      ...Array.from({ length: 10 }, (_, i) => mk(`ham${i}`, 100, true)),
      mk('ver', 100, false),
    ];
    const r = settlePool(bets);
    expect(r.payouts.filter(p => p.outcome === 'won').every(p => p.payout === 110)).toBe(true); // 100 + 10
    expect(find(r, 'ver')).toMatchObject({ outcome: 'lost', payout: 0 });
    expect(r.remainder).toBe(0);
  });

  it('no winner → everyone refunded + void', () => {
    const r = settlePool([mk('a', 100, false), mk('b', 50, false)]);
    expect(r.refunded).toBe(true);
    expect(find(r, 'a')).toMatchObject({ outcome: 'void', payout: 100 });
    expect(find(r, 'b')).toMatchObject({ outcome: 'void', payout: 50 });
  });

  it('uneven stakes: pro-rata, dust to the house', () => {
    // pool 100; winner stakes 3 + 4 = 7 → 3/7*100=42, 4/7*100=57; dust 1
    const r = settlePool([mk('w1', 3, true), mk('w2', 4, true), mk('l', 93, false)]);
    expect(find(r, 'w1').payout).toBe(42);
    expect(find(r, 'w2').payout).toBe(57);
    expect(r.remainder).toBe(1);
  });
});
