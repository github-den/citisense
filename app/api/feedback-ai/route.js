import { NextResponse } from 'next/server';
import { createStructuredResponse } from '@/server/openaiStructured.js';

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

const moodPredictionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mood', 'confidence', 'rationale'],
  properties: {
    mood: {
      type: 'string',
      enum: ['grateful', 'satisfied', 'sad', 'angry'],
    },
    confidence: {
      type: 'number',
    },
    rationale: {
      type: 'string',
    },
  },
};

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

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

  if (body.task === 'mood_prediction') {
    const result = await createStructuredResponse({
      name: 'feedback_mood_prediction',
      schema: moodPredictionSchema,
      instructions: [
        'You classify one civic feedback text into exactly one of these four moods: grateful, satisfied, sad, angry.',
        'Do not output any mood outside those four labels.',
        'Base the classification on the writer tone and intent in the feedback text.',
        'Use grateful for strong appreciation or thanks.',
        'Use satisfied for calm positive or constructive approval.',
        'Use sad for disappointment, discouragement, or concern without strong hostility.',
        'Use angry for frustration, outrage, harsh blame, or strong hostility.',
        'Return confidence as a number from 0 to 1.',
        'Keep rationale short and specific.',
      ].join(' '),
      input: JSON.stringify({
        type: body.type,
        service: body.service,
        barangay: body.barangay,
        content: body.content,
      }),
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      mood: result.data.mood,
      confidence: clampConfidence(result.data.confidence),
      rationale: result.data.rationale ?? '',
      source: 'ai_structured_fallback',
    });
  }

  return NextResponse.json({ error: 'Unsupported AI task.' }, { status: 400 });
}
