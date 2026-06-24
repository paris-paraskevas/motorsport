import { redirect } from 'next/navigation';

// Friends + leagues are one page now (/social, two columns). This list route
// redirects there; league detail (/social/leagues/[id]) + join (/join/[token])
// keep their own routes.
export default function LeaguesPage() {
  redirect('/social');
}
