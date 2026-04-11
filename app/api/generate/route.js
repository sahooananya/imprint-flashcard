import pdf from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';

export const runtime = 'nodejs';

// Extract text from PPTX by reading slide XML directly
async function extractPPTX(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort();

  if (slideFiles.length === 0) throw new Error('No slides found in PowerPoint file.');

  const texts = await Promise.all(
    slideFiles.map(async (slidePath) => {
      const xml = await zip.files[slidePath].async('text');
      // Extract all <a:t> text nodes from slide XML
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      return matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    })
  );

  return texts.filter(Boolean).join('\n\n');
}

async function extractText(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const type   = file.type;
  const name   = (file.name || '').toLowerCase();

  if (type === 'application/pdf') {
    const data = await pdf(buffer);
    return data.text;
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    type === 'application/vnd.ms-powerpoint' ||
    name.endsWith('.pptx') || name.endsWith('.ppt')
  ) {
    return await extractPPTX(buffer);
  }

  if (type.startsWith('image/')) {
    const base64 = buffer.toString('base64');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${type};base64,${base64}` } },
            { type: 'text', text: 'Extract ALL text, formulas, labels, and content from this image. Output only the raw content.' },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error('Image extraction failed');
    const d = await res.json();
    return d.choices[0].message.content;
  }

  throw new Error('Unsupported file type. Upload PDF, PPTX, JPG, or PNG.');
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const mode = formData.get('mode') || 'standard';

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const cardCounts = { quick: 10, standard: 20, deep: 35 };
    const cardCount  = cardCounts[mode] || 20;

    const rawText = await extractText(file);
    if (!rawText || rawText.trim().length < 30) {
      return Response.json({ error: 'Not enough content found in file.' }, { status: 400 });
    }

    const text = rawText.slice(0, 12000);

    // Pass 1 — extract topics
    let topics = [];
    try {
      const topicRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', temperature: 0.2,
          messages: [
            { role: 'system', content: 'Respond only with a valid JSON array of strings. No markdown.' },
            { role: 'user', content: `Extract main topics/sections. Return max 10 as JSON array:\n\n${text.slice(0, 3000)}` },
          ],
        }),
      });
      if (topicRes.ok) {
        const td = await topicRes.json();
        topics = JSON.parse(td.choices[0].message.content.trim().replace(/```json|```/g, ''));
      }
    } catch { topics = []; }

    // Pass 2 — generate cards
    const cardRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', temperature: 0.4,
        messages: [
          { role: 'system', content: 'You are an expert educator. Respond only with a valid JSON array. No markdown.' },
          { role: 'user', content: `Create exactly ${cardCount} high-quality flashcards from this material.

Include a mix of:
- "concept": what something is and why it matters
- "definition": precise meaning of a term
- "example": applies knowledge to a problem

Rules: specific questions, 1-3 sentence answers, no trivial questions, comprehensive coverage.

Return ONLY JSON array:
[{"question":"...","answer":"...","topic":"label","type":"concept|definition|example"}]

TEXT:\n${text}` },
        ],
      }),
    });

    if (!cardRes.ok) {
      const err = await cardRes.json();
      throw new Error(err.error?.message || 'Groq API error');
    }

    const cd    = await cardRes.json();
    const raw   = cd.choices[0].message.content.trim().replace(/```json|```/g, '');
    const cards = JSON.parse(raw);

    if (!Array.isArray(cards) || !cards.length) throw new Error('Invalid card format');

    const enriched = cards.map((card, i) => ({
      id: `card_${Date.now()}_${i}`,
      question: card.question, answer: card.answer,
      topic: card.topic || 'General', type: card.type || 'concept',
      repetitions: 0, easeFactor: 2.5, interval: 0,
      nextReview: null, lastReviewed: null,
    }));

    return Response.json({ cards: enriched, topics, mode });
  } catch (err) {
    console.error('Generate error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
