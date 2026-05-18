export const FEEDBACK_REPORT_FLAGS = [
  'Not about a government service',
  'Outside service coverage area',
  'Spam',
  'AI generated evidence',
  'Harassment or threatening behavior',
  'Offensive or discriminatory content',
  'False or misleading information',
  'Contains personal information',
];

export const DISCUSSION_REPORT_FLAGS = FEEDBACK_REPORT_FLAGS.filter((flag) => (
  [
    'Spam',
    'Harassment or threatening behavior',
    'Offensive or discriminatory content',
    'False or misleading information',
    'Contains personal information',
  ].includes(flag)
)).concat([
  'Off-topic or derailing the discussion',
]);
