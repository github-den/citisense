import { redirect } from 'next/navigation';

export default async function LegacyDiscussRoute({ params }) {
  const { id } = await params;
  redirect(`/post/${id}`);
}
