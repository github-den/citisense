import { NextResponse } from 'next/server';
import { createStructuredResponse } from '@/server/openaiStructured.js';
import { predictFeedbackMood } from '@/server/moodPredictor.js';

export const runtime = 'nodejs';

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
    try {
      const prediction = await predictFeedbackMood(body.content);

      return NextResponse.json({
        mood: prediction.mood,
        confidence: prediction.confidence,
        rationale: 'Predicted by the local xlm-roberta-base-round1 checkpoint.',
        source: prediction.modelVersion,
        raw_mood: prediction.mood,
        is_public: prediction.isPublic,
        prediction_model_version: prediction.modelVersion,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error?.message ?? 'Mood prediction failed.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: 'Unsupported AI task.' }, { status: 400 });
}
