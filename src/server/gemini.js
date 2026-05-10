import { GoogleGenerativeAI } from '@google/generative-ai';

function stripMarkdownFences(text = '') {
  let out = String(text ?? '').trim();
  if (!out) return '';
  out = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return out;
}

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

export async function geminiText({ model = 'gemini-2.5-flash', prompt }) {
  const client = getGeminiClient();
  if (!client) throw new Error('GEMINI_API_KEY is not configured.');

  const gm = client.getGenerativeModel({ model });
  const result = await gm.generateContent(prompt);
  const text = result?.response?.text?.() ?? '';
  return stripMarkdownFences(text);
}

export function parseJsonFromGemini(text) {
  const cleaned = stripMarkdownFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const preview = cleaned.slice(0, 240);
    throw new Error(`Unable to parse Gemini JSON. Preview: ${preview}`);
  }
}

