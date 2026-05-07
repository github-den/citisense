import { redirect } from 'next/navigation';

export default function ForLaterRoute() {
  redirect('/profile?tab=forlater');
}
