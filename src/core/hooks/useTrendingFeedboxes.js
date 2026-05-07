import { useMemo } from 'react';
import { useFeedboxes } from './useFeedboxes.js';

function rankingScore(box) {
  const raises = Number(box?.raises_count ?? 0);
  const feedback = Number(box?.feedback_count ?? 0);
  const reacts = Number(box?.reacts_count ?? 0);
  const discuss = Number(box?.discuss_count ?? 0);
  return feedback + raises + reacts + discuss;
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function useTrendingFeedboxes({ top = 10, pick = 4 } = {}) {
  const { feedboxes, loading } = useFeedboxes();

  const topTen = useMemo(() => {
    return [...(feedboxes ?? [])]
      .filter((row) => Number(row?.feedback_count ?? 0) > 0)
      .sort((a, b) => rankingScore(b) - rankingScore(a))
      .slice(0, top);
  }, [feedboxes, top]);

  const picked = useMemo(() => {
    return pickRandom(topTen, pick);
  }, [topTen, pick]);

  return { topTen, picked, loading };
}
