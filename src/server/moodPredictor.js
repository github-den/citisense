import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_CONFIDENCE_THRESHOLD = 0.30;
const MODEL_VERSION = 'citisense/emotion-detection';
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const PREDICT_SCRIPT = resolve(REPO_ROOT, 'emotion-model', 'predict_mood.py');
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['python', 'py']
  : ['python3', 'python'];
const ALLOWED_MOODS = new Set(['grateful', 'satisfied', 'sad', 'angry']);

function createEmptyMoodBreakdown() {
  return {
    grateful: 0,
    satisfied: 0,
    sad: 0,
    angry: 0,
  };
}

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function extractJsonPayload(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) {
    throw new Error('Mood predictor returned empty output.');
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) {
      throw new Error('Mood predictor returned invalid JSON.');
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeMood(value) {
  const mood = String(value ?? '').trim().toLowerCase();
  return ALLOWED_MOODS.has(mood) ? mood : null;
}

function normalizeBreakdown(value) {
  const breakdown = createEmptyMoodBreakdown();
  if (!value || typeof value !== 'object') return breakdown;

  for (const mood of Object.keys(breakdown)) {
    const numeric = Number(value[mood] ?? 0);
    breakdown[mood] = Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
  }

  const total = Object.values(breakdown).reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) return breakdown;

  for (const mood of Object.keys(breakdown)) {
    breakdown[mood] = Number((breakdown[mood] / total).toFixed(6));
  }

  return breakdown;
}

function normalizePrediction(rawPrediction) {
  const mood = normalizeMood(rawPrediction?.mood);
  const confidence = clampConfidence(rawPrediction?.confidence);
  const modelVersion = String(rawPrediction?.model_version ?? MODEL_VERSION).trim() || MODEL_VERSION;
  const breakdown = normalizeBreakdown(rawPrediction?.breakdown);

  return {
    mood,
    confidence,
    breakdown,
    modelVersion,
    isPublic: Boolean(mood) && confidence >= PUBLIC_CONFIDENCE_THRESHOLD,
  };
}

export function toFeedbackPredictionColumns(prediction) {
  if (!prediction?.mood) {
    return {
      predicted_mood: null,
      predicted_mood_confidence: null,
      predicted_mood_breakdown: null,
      prediction_model_version: null,
    };
  }

  return {
    predicted_mood: prediction.mood,
    predicted_mood_confidence: prediction.confidence,
    predicted_mood_breakdown: prediction.breakdown,
    prediction_model_version: prediction.modelVersion,
  };
}

export async function predictFeedbackMood(text) {
  const content = String(text ?? '').trim();
  if (!content) {
    return {
      mood: null,
      confidence: 0,
      breakdown: createEmptyMoodBreakdown(),
      modelVersion: MODEL_VERSION,
      isPublic: false,
    };
  }

  let lastError = null;

  for (const command of PYTHON_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(
        command,
        [PREDICT_SCRIPT, '--model-id', MODEL_VERSION, '--text', content],
        {
          cwd: REPO_ROOT,
          maxBuffer: 1024 * 1024,
          timeout: 120000,
          windowsHide: true,
        },
      );

      return normalizePrediction(extractJsonPayload(stdout));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Mood predictor failed: ${lastError?.message ?? 'unknown error'}`);
}

export { MODEL_VERSION, PUBLIC_CONFIDENCE_THRESHOLD };
