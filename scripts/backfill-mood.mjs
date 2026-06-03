import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '..');
const PREDICT_SCRIPT = resolve(REPO_ROOT, 'emotion-model', 'predict_mood.py');
const MODEL_DIR = resolve(REPO_ROOT, 'emotion-model', 'checkpoints', 'xlm-roberta-base-round1', 'best');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function predictMood(text) {
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'python' : 'python3',
      [PREDICT_SCRIPT, '--model-dir', MODEL_DIR, '--text', text],
      { cwd: REPO_ROOT, maxBuffer: 1024 * 1024, timeout: 120000, windowsHide: true }
    );
    const textOut = String(stdout ?? '').trim();
    const start = textOut.indexOf('{');
    const end = textOut.lastIndexOf('}');
    if (start >= 0 && end >= start) {
      return JSON.parse(textOut.slice(start, end + 1));
    }
    return JSON.parse(textOut);
  } catch (error) {
    console.error('Prediction failed:', error.message);
    return null;
  }
}

async function backfill() {
  console.log('Fetching feedbacks without predicted mood...');
  const { data: feedbacks, error } = await supabase
    .from('feedbacks')
    .select('id, caption')
    .is('predicted_mood', null)
    .limit(100); // Process in batches of 100

  if (error) {
    console.error('Error fetching feedbacks:', error);
    return;
  }

  if (!feedbacks || feedbacks.length === 0) {
    console.log('No feedbacks to backfill. All done!');
    return;
  }

  console.log(`Found ${feedbacks.length} feedbacks to process.`);

  for (const feedback of feedbacks) {
    console.log(`Processing feedback ${feedback.id}...`);
    const prediction = await predictMood(feedback.caption);
    
    if (prediction && prediction.mood) {
      const { error: updateError } = await supabase
        .from('feedbacks')
        .update({
          predicted_mood: prediction.mood,
          predicted_mood_confidence: prediction.confidence,
          predicted_mood_breakdown: prediction.breakdown,
          prediction_model_version: prediction.model_version || 'xlm-roberta-base-round1'
        })
        .eq('id', feedback.id);

      if (updateError) {
        console.error(`Error updating feedback ${feedback.id}:`, updateError);
      } else {
        console.log(`Successfully updated feedback ${feedback.id} with mood: ${prediction.mood}`);
      }
    } else {
      console.log(`No mood predicted for feedback ${feedback.id}`);
    }
  }

  console.log('Backfill batch completed. Run the script again to process the next batch.');
}

backfill();