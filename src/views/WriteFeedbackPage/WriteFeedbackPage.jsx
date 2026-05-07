import { useRouter } from 'next/navigation';
import FeedbackComposerPage from '../../components/FeedbackComposerPage/FeedbackComposerPage.jsx';

export default function WriteFeedbackPage() {
  const router = useRouter();

  return <FeedbackComposerPage setPage={(nextPage) => {
    if (nextPage === 'feed') {
      router.push('/feed');
      return;
    }

    router.back();
  }}
  mode="create"
  />;
}
