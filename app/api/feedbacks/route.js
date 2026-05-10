import { NextResponse } from 'next/server';
import { predictFeedbackMood, toFeedbackPredictionColumns } from '@/server/moodPredictor.js';
import { requireRequestUser } from '@/server/requestAuth.js';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

export const runtime = 'nodejs';

function isLegacySchemaInsertError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('author_id')
    || message.includes('category')
    || message.includes('caption')
    || message.includes('incident_location');
}

function buildModernPayload(body, userId) {
  return {
    user_id: userId,
    caption: String(body.content ?? '').trim(),
    type: body.type || null,
    service: body.service || null,
    incident_location: body.location || body.barangay || 'Unknown',
    image_url: body.imageUrl || null,
    image_urls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
  };
}

async function insertFeedback(admin, payload) {
  const primaryInsert = await admin
    .from('feedbacks')
    .insert(payload)
    .select('id, feedback_no')
    .single();

  if (!primaryInsert.error || !isLegacySchemaInsertError(primaryInsert.error)) {
    return primaryInsert;
  }

  return admin
    .from('feedbacks')
    .insert({
      ...payload,
      category: payload.type,
    })
    .select('id, feedback_no')
    .single();
}

export async function POST(request) {
  const auth = await requireRequestUser(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const content = String(body.content ?? '').trim();
  if (!content) {
    return NextResponse.json({ error: 'Feedback content is required.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  const payload = buildModernPayload(body, auth.user.id);
  const insertResult = await insertFeedback(admin, payload);
  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { error: insertResult.error?.message ?? 'Unable to create feedback.' },
      { status: 500 },
    );
  }

  let predictionColumns = {
    predicted_mood: null,
    predicted_mood_confidence: null,
    prediction_model_version: null,
  };

  try {
    const prediction = await predictFeedbackMood(content);
    predictionColumns = toFeedbackPredictionColumns(prediction);

    const updateResult = await admin
      .from('feedbacks')
      .update(predictionColumns)
      .eq('id', insertResult.data.id);

    if (updateResult.error) {
      console.error('Unable to persist feedback mood prediction:', updateResult.error);
    }
  } catch (error) {
    console.error('Unable to generate feedback mood prediction:', error);
  }

  return NextResponse.json({
    ...insertResult.data,
    ...predictionColumns,
  });
}
