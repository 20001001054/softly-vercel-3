// Vercel serverless function: POST /api/chat
// Holds the Gemini key on the server (env var GEMINI_API_KEY). The browser never sees it.

const SYSTEM = `You are Jing, a warm, bright and calm companion inside a wellbeing app called Softly.
You are an AI, not a licensed therapist. Never diagnose, never give medical or medication advice, never claim to be human. If someone calls you their therapist, gently and briefly say you are an AI companion and cannot replace a therapist.
Use plain, kind language. Keep replies short (2 to 5 sentences) unless asked for something longer. No markdown, no lists, no emojis. Reflect what you heard first, ask at most one gentle question at a time, and avoid toxic positivity and lecturing.
Safety: if the person mentions wanting to die, hurting themselves, or being in danger, respond with calm and care, say they deserve support from a real person right now, encourage contacting local emergency services or a free helpline, and never give methods or details.`;

const hits = new Map(); // best-effort per-IP limit (per warm instance)
const LIMIT = 20, WINDOW = 60000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'server not configured' });

  // Same-site only: reject requests coming from another website.
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let oh = ''; try { oh = new URL(origin).host; } catch {}
    if (oh !== host) return res.status(403).json({ error: 'origin not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (recent.length >= LIMIT) return res.status(429).json({ error: 'rate limited' });
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !Array.isArray(body.messages)) return res.status(400).json({ error: 'bad request' });

  const msgs = body.messages.slice(-24)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.content.slice(0, 4000) }));
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.text += '\n\n' + m.text; else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  if (!merged.length || merged[merged.length - 1].role !== 'user') return res.status(400).json({ error: 'bad messages' });

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: merged.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { maxOutputTokens: 900, temperature: 0.9 },
      }),
    });
  } catch { return res.status(502).json({ error: 'upstream unreachable' }); }

  if (r.status === 429) return res.status(429).json({ error: 'rate limited' });
  if (!r.ok) return res.status(502).json({ error: 'upstream error' });
  const data = await r.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) return res.status(200).json({ text: "I'm not able to answer that one. If you are in danger or thinking of hurting yourself, please contact your local emergency number or a free helpline right now." });
  return res.status(200).json({ text });
}
