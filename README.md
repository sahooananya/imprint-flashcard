# Recall — Smart Flashcard Engine

Turn any PDF into a practice-ready flashcard deck powered by spaced repetition.

## What it does

- Upload a PDF → Claude AI generates 15–25 high-quality flashcards
- Study with card flip UI (click or press Space)
- Rate recall quality (1–5) → SM-2 algorithm schedules next review
- Track mastery progress per deck
- Browse all cards by status (new / learning / struggling / mastered)
- Keyboard shortcuts for fast review

## Tech Stack

- **Next.js 14** (App Router) — React framework
- **Tailwind CSS** — styling
- **Claude claude-opus-4-5 API** — card generation
- **pdf-parse** — PDF text extraction
- **SM-2 algorithm** — spaced repetition scheduling
- **localStorage** — persistence (no database needed)

## Local Development

```bash
npm install
cp .env.local .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import repo
3. Add environment variable: `ANTHROPIC_API_KEY = your_key`
4. Deploy — done.

## Key Decisions

**Why localStorage over a database?**
Zero infrastructure. No signup required. Works instantly. The tradeoff is data doesn't persist across devices, but for a study tool used on one machine, this is fine.

**Why SM-2?**
It's the algorithm behind Anki, battle-tested since 1987. Simple to implement (~40 lines), mathematically sound, and easy to explain. Custom algorithms exist but SM-2 is the right tradeoff between complexity and effectiveness.

**Why Next.js?**
API routes keep the Anthropic API key server-side (never exposed to the browser). One repo = frontend + backend. Vercel deployment is one click.

**Card quality over quantity**
Claude is prompted to write cards like a great teacher — covering relationships, edge cases, and "why" questions — not just scraping surface facts.
