import type { AccountStats as Stats } from '@/lib/betting/account';

// Personal stats strip on the Account page (own account, signed-in): credits +
// an Instagram-style friends / leagues / joined row. Pure render of the numbers
// the page fetched server-side; visible only to the account owner.
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <span className="block font-display text-lg font-bold tabular-nums leading-none text-text">{value}</span>
      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{label}</span>
    </div>
  );
}

export function AccountStats({ stats }: { stats: Stats }) {
  const joined = stats.joinedAt
    ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(stats.joinedAt))
    : '—';
  return (
    <div className="mb-6 border-b border-border pb-5">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-extrabold tabular-nums text-brand">{stats.balance.toLocaleString()}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">credits</span>
      </div>
      <div className="mt-4 flex gap-8">
        <Stat value={stats.friendCount} label="Friends" />
        <Stat value={stats.leagueCount} label="Leagues" />
        <Stat value={joined} label="Joined" />
      </div>
    </div>
  );
}
