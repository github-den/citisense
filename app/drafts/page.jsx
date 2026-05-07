import { redirect } from 'next/navigation';

export default function DraftsRoute() {
  redirect('/profile?tab=drafts');
}
