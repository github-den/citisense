import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PUBLIC_CONFIDENCE_THRESHOLD = 0.30;
const MODEL_VERSION = 'xlm-roberta-base-round1';
const REPO_ROOT = resolve(process.cwd(), '..');
const PREDICT_SCRIPT = resolve(REPO_ROOT, 'emotion-model', 'predict_mood.py');
const MODEL_DIR = resolve(REPO_ROOT, 'emotion-model', 'checkpoints', MODEL_VERSION, 'best');
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['python', 'py']
  : ['python3', 'python'];
const ALLOWED_MOODS = new Set(['grateful', 'satisfied', 'sad', 'angry']);

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

function normalizePrediction(rawPrediction) {
  const mood = normalizeMood(rawPrediction?.mood);
  const confidence = clampConfidence(rawPrediction?.confidence);
  const modelVersion = String(rawPrediction?.model_version ?? MODEL_VERSION).trim() || MODEL_VERSION;

  return {
    mood,
    confidence,
    modelVersion,
    isPublic: Boolean(mood) && confidence >= PUBLIC_CONFIDENCE_THRESHOLD,
  };
}

export function toFeedbackPredictionColumns(prediction) {
  if (!prediction?.isPublic || !prediction.mood) {
    return {
      predicted_mood: null,
      predicted_mood_confidence: null,
      prediction_model_version: null,
    };
  }

  return {
    predicted_mood: prediction.mood,
    predicted_mood_confidence: prediction.confidence,
    prediction_model_version: prediction.modelVersion,
  };
}

export async function predictFeedbackMood(text) {
  const content = String(text ?? '').trim();
  if (!content) {
    return {
      mood: null,
      confidence: 0,
      modelVersion: MODEL_VERSION,
      isPublic: false,
    };
  }

  let lastError = null;

  for (const command of PYTHON_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(
        command,
        [PREDICT_SCRIPT, '--model-dir', MODEL_DIR, '--text', content],
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
