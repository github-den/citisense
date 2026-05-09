import { formatMoodLabel } from '@core/utils/mood.js';
import { Info } from '@phosphor-icons/react';
import styles from './RightAside.module.css';

export function trimText(text, max = 80) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function safeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function getMoodLabel(mood) {
  return formatMoodLabel(mood);
}

export function EmptyState({ children }) {
  return (
    <div className={styles.emptyState}>
      <Info size={17} weight="fill" color="var(--text-3)" />
      <span>{children}</span>
    </div>
  );
}

export const DEFAULT_SETUP_HINTS = [
  'Your display name and username can also be changed later in Edit profile.',
  'Use a name that citizens and offices can recognize clearly.',
];

export const INITIATIVE_SIDEBAR = {
  completed: [
    {
      title: 'Public service wayfinding refresh',
      office: 'City Planning and Development Office',
      meta: 'Completed this month',
    },
    {
      title: 'Expanded primary care help desks',
      office: 'City Health Office',
      meta: 'Service flow improved',
    },
  ],
  planned: [
    {
      title: 'Drainage clearing for flood-prone streets',
      office: 'City Engineers Office',
      meta: 'Queued for rollout',
    },
    {
      title: 'Mobile livelihood assistance clinic',
      office: 'City Social Welfare and Development Office',
      meta: 'Pending field window',
    },
  ],
};
