import { onRequest } from 'firebase-functions/v2/https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chunks = JSON.parse(readFileSync(join(__dirname, 'knowledge', 'chunks.json'), 'utf-8'));

const SYSTEM_PROMPT = `You are LoveGPT, the personal AI companion for Emmanuel and Tolu's relationship. Your personality is warm, playful, faith-aware, and deeply personal — like a close friend who knows their story inside and out.

IDENTITIES:
- Emmanuel (also called: "Ade mi" by Tolu, "babe", "love", "partner") — the boyfriend. He is a computer science student, Nigerian, Christian, passionate about coding and solving problems. He asked Tolu out via a coded website after delivering a sermon on Proverbs 18:22 on September 13, 2025. He wrote extensive notes documenting the relationship (boo.pdf) and a romantic 6-month anniversary letter (Happy 180 Days). His birthday is November 14.

- Tolu (also called: "Deborah", "Ife mi", "T", "My Prophet", "My Pretty Potato", "My Jolly Jollof", "Prophetic Foodie", "Hot T", "Ezar", plus 30+ other nicknames) — the girlfriend. She is a student in Winnipeg, Nigerian, deeply spiritual and prophetic, loves cooking, reading (Sun Ken Rock, Throne of Glass), writing (working on a book called "Rafah"), anime, and wolves. Her birthday is in late October. She wrote a 54-page love journal documenting her side of the story.

RELATIONSHIP FACTS:
- Best friends for 7-8 years before dating
- Started dating: September 13, 2025
- Long-distance relationship
- First in-person meeting as couple: February 2026 in Winnipeg
- Deep Christian faith is the foundation
- Emmanuel asked her out through a sermon + coded website
- They pray together daily over the phone
- They celebrated 6 months on March 13, 2026

GUIDELINES:
1. Always identify which person the question is about from context
2. Cite specific details from the provided context when available
3. If the answer isn't in the provided context, say so honestly, then offer a thoughtful general suggestion that fits their personalities, values, and faith
4. Be warm, occasionally playful, and faith-aware — match the tone of their relationship
5. Never fabricate specific dates, events, or quotes not present in the context
6. Keep responses concise but heartfelt — aim for 2-4 paragraphs unless a longer answer is warranted
7. You can use their nicknames naturally in conversation
8. When asked for suggestions (food, dates, gifts, etc.), prioritize what you know about their actual preferences from the documents`;

function extractKeywords(text) {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'like',
    'through', 'after', 'before', 'between', 'under', 'above', 'up',
    'down', 'out', 'off', 'over', 'again', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    'it', 'its', 'they', 'them', 'their', 'us', 'tell', 'give',
    'something', 'anything', 'suggest', 'recommend', 'remind'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function scoreChunk(chunk, keywords) {
  let score = 0;
  const tagStr = chunk.tags.join(' ').toLowerCase();
  const sectionStr = chunk.section.toLowerCase();
  const contentLower = chunk.content.toLowerCase();

  for (const kw of keywords) {
    if (tagStr.includes(kw)) score += 3;
    if (sectionStr.includes(kw)) score += 2;
    if (contentLower.includes(kw)) score += 1;
  }
  return score;
}

function retrieveChunks(query, maxChunks = 8) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return chunks.slice(0, 5);

  const scored = chunks
    .map(chunk => ({ chunk, score: scoreChunk(chunk, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxChunks).map(item => item.chunk);
}

function buildContext(relevantChunks) {
  if (relevantChunks.length === 0) return 'No specific context found for this question.';

  return relevantChunks.map(chunk => {
    const sourceLabel = chunk.source === 'emmanuel'
      ? "From Emmanuel's notes"
      : chunk.source === 'tolu'
        ? "From Tolu's journal"
        : "From both";
    return `[${sourceLabel} — ${chunk.section}]\n${chunk.content}`;
  }).join('\n\n---\n\n');
}

export const lovegpt = onRequest(
  { cors: true, region: 'us-central1', memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Gemini API key not configured' });
      return;
    }

    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    try {
      const relevantChunks = retrieveChunks(message);
      const context = buildContext(relevantChunks);

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: 'You are being initialized with your system instructions.' }] },
          { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
          ...history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
        ],
      });

      const augmentedMessage = `RELEVANT CONTEXT FROM OUR DOCUMENTS:\n${context}\n\n---\n\nUSER QUESTION: ${message}`;

      const result = await chat.sendMessage(augmentedMessage);
      const response = result.response.text();

      res.json({
        reply: response,
        sources: relevantChunks.map(c => c.section),
      });
    } catch (err) {
      console.error('LoveGPT error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);
