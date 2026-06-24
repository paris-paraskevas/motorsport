import { redirect } from 'next/navigation';

// Friends + leagues are one page now (/social, two columns). This list route
// redirects there; the friend-add flow keeps its own /social/friends/add/[id] route.
export default function FriendsPage() {
  redirect('/social');
}
