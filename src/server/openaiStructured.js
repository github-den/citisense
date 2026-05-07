const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash-lite';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-5-mini';

function extractOpenAiOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .join('')
    .trim();
}

function extractGeminiOutputText(response) {
  return (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function safeParseJson(text) {
  try {
    return { data: JSON.parse(text), error: null };
  } catch {
    return { data: null, error: 'AI response was not valid JSON.' };
  }
}

function buildProviderOrder() {
  if (AI_PROVIDER === 'gemini') return ['gemini'];
  if (AI_PROVIDER === 'openai') return ['openai'];
  return ['gemini', 'openai'];
}

async function runGeminiStructuredResponse({ instructions, input, schema }) {
  if (!GEMINI_API_KEY) {
    return { data: null, error: 'GEMINI_API_KEY is not configured.', status: 503 };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${instructions}\n\nReturn only valid JSON matching the provided schema.\n\nInput:\n${input}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        data: null,
        error: payload.error?.message ?? 'Gemini analysis failed.',
        status: response.status,
      };
    }

    const parsed = safeParseJson(extractGeminiOutputText(payload));
    if (parsed.error) return { data: null, error: parsed.error, status: 502 };
    return { data: parsed.data, error: null, status: 200, provider: 'gemini' };
  } catch (error) {
    return {
      data: null,
      error: error?.message ?? 'Gemini request failed.',
      status: 502,
    };
  }
}

async function runOpenAiStructuredResponse({ instructions, input, schema, name }) {
  if (!OPENAI_API_KEY) {
    return { data: null, error: 'OPENAI_API_KEY is not configured.', status: 503 };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        data: null,
        error: payload.error?.message ?? 'OpenAI analysis failed.',
        status: response.status,
      };
    }

    const parsed = safeParseJson(extractOpenAiOutputText(payload));
    if (parsed.error) return { data: null, error: parsed.error, status: 502 };
    return { data: parsed.data, error: null, status: 200, provider: 'openai' };
  } catch (error) {
    return {
      data: null,
      error: error?.message ?? 'OpenAI request failed.',
      status: 502,
    };
  }
}

export async function createStructuredResponse({ instructions, input, schema, name }) {
  const providers = buildProviderOrder();
  const errors = [];

  for (const provider of providers) {
    const result = provider === 'gemini'
      ? await runGeminiStructuredResponse({ instructions, input, schema, name })
      : await runOpenAiStructuredResponse({ instructions, input, schema, name });

    if (!result.error) return result;
    errors.push(`${provider}: ${result.error}`);
  }

  return {
    data: null,
    error: errors.length > 0
      ? `No AI provider succeeded. ${errors.join(' | ')}`
      : 'No AI provider is configured.',
    status: 503,
  };
}
