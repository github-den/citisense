import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .join('')
    .trim();
}

async function createStructuredResponse({ instructions, input, schema, name }) {
  if (!OPENAI_API_KEY) {
    return { data: null, error: 'OPENAI_API_KEY is not configured.', status: 503 };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions,
      input,
      text: {
        format: {
          type: 'json_schema',
          name,
          strict: true,
          schema,
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return {
      data: null,
      error: payload.error?.message ?? 'AI analysis failed.',
      status: response.status,
    };
  }

  try {
    return { data: JSON.parse(extractOutputText(payload)), error: null, status: 200 };
  } catch {
    return { data: null, error: 'AI response was not valid JSON.', status: 502 };
  }
}

const contentFlagsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rejected', 'rejectionReason', 'flags', 'tips'],
  properties: {
    rejected: { type: 'boolean' },
    rejectionReason: { type: 'string' },
    flags: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
  },
};

const feedboxMatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'matchedFeedboxId', 'newFeedboxTitle', 'checks'],
  properties: {
    kind: { type: 'string', enum: ['match', 'new'] },
    matchedFeedboxId: { type: 'string' },
    newFeedboxTitle: { type: 'string' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'done'],
        properties: {
          label: { type: 'string', enum: ['Month/year', 'Subject', 'Service category', 'Incident location'] },
          done: { type: 'boolean' },
        },
      },
    },
  },
};

export async function POST(request) {
  const body = await request.json();

  if (body.task === 'content_flags') {
    const result = await createStructuredResponse({
      name: 'feedback_content_flags',
      schema: contentFlagsSchema,
      instructions: [
        'You are a civic feedback quality checker for Urdaneta City.',
        'Analyze citizen feedback for jurisdiction and quality.',
        'REJECTION CRITERIA (Set rejected: true only for this):',
        '1. Outside jurisdiction: The report is about an incident clearly outside Urdaneta City. Use rejectionReason: "The incident appears to be outside the vicinity of Urdaneta."',
        'CONTENT FLAGS (Add to flags array, but do NOT set rejected: true for these):',
        '1. "Gibberish": The content is random characters or repeated symbols.',
        '2. "Trolling": The content is clearly a joke or nonsensical.',
        '3. "Lacks actionable details": The content does not clearly answer "What happened?".',
        '4. "No civic relevance": The content is a personal attack or unrelated to public services.',
        '5. "Emotional/foul language": The content uses offensive or overly emotional words.',
        '6. "AI-generated media": If media labels suggest the image/video is not original.',
        'Provide helpful tips for improvement in the tips array.',
      ].join(' '),
      input: JSON.stringify({
        type: body.type,
        service: body.service,
        barangay: body.barangay,
        location: body.location,
        content: body.content,
        evidenceNote: body.evidenceNote,
        mediaLabels: body.mediaLabels ?? [],
      }),
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data);
  }

  if (body.task === 'feedbox_match') {
    const result = await createStructuredResponse({
      name: 'feedback_feedbox_match',
      schema: feedboxMatchSchema,
      instructions: [
        'You match a new Urdaneta City civic feedback item to an existing feedbox only when all four checks are satisfied:',
        'month/year, subject, service category, and incident location.',
        'Use the existing feedboxes list only. Do not invent a matched feedbox id.',
        'If any check is not satisfied for the best candidate, return kind "new" and an empty matchedFeedboxId.',
        'For newFeedboxTitle, do not include month/year. Use a short title in this pattern: "<feedback type> <service or subject> dito sa <incident location>".',
      ].join(' '),
      input: JSON.stringify({
        monthYear: body.monthYear,
        feedback: body.feedback,
        feedboxes: body.feedboxes,
      }),
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data);
  }

  return NextResponse.json({ error: 'Unsupported AI task.' }, { status: 400 });
}
