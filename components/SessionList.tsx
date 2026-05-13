import { Session } from '@/lib/types';
import { SessionCard } from './SessionCard';

export function SessionList({
  items,
  emptyLabel = 'Nothing scheduled.',
}: {
  items: Array<{ session: Session; color: string }>;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <div className="text-zinc-600 text-sm">{emptyLabel}</div>;
  }
  return (
    <div>
      {items.map(({ session, color }) => (
        <SessionCard key={`${session.seriesSlug}-${session.uid}`} session={session} color={color} />
      ))}
    </div>
  );
}
