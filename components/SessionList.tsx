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
    return <div className="text-text-faint text-sm">{emptyLabel}</div>;
  }
  return (
    <div className="border-t border-border">
      {items.map(({ session, color }) => (
        <SessionCard key={`${session.seriesSlug}-${session.uid}`} session={session} color={color} />
      ))}
    </div>
  );
}
