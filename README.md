# Imprint — Leave a mark on your memory.

Built for the long game.

Imprint turns any PDF, PowerPoint, or image into a smart flashcard deck — then helps you actually retain what you studied using spaced repetition and active recall.

Live at **[Here](https://imprint-flashcard.vercel.app)**

---

## Why I built this

Most flashcard apps are just card flippers. You flip, you read, you move on. That's recognition — not recall. And recognition fades fast.

I built Imprint around a different belief: the act of retrieving information is what makes it stick. Not re-reading. Not passively flipping. Actually pulling the answer out of your head — under mild pressure, spaced over time.

Every decision in this project came from that belief.

---

## What it does

**Upload anything**
Drop in a PDF, a PowerPoint deck, or a photo of your notes. Imprint extracts the content and generates flashcards that cover concepts, definitions, and worked examples — not just surface facts.

**Four study modes**
- **Flashcard Review** — flip and rate. SM-2 schedules what comes next
- **Active Recall** — type your answer before the reveal. Forces real retrieval
- **MCQ Practice** — four options per card, distractors pulled from your own deck
- **Test Mode** — timed session, pure assessment, SM-2 not updated so it doesn't corrupt your review schedule

**Spaced repetition that actually works**
Every card has its own ease factor and interval. Rate something easy — it fades for weeks. Rate it hard — it's back tomorrow. Mastery requires correct recall across three separate sessions on different days. One good run doesn't count.

**Progress that means something**
Mastery percentage, weak area detection, next review dates on every card, daily streak tracking, and a session summary that shows improvement over time.

**Dark and light mode**
Because you're going to be staring at this for a while.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 | API routes keep the key server-side. One repo, frontend + backend |
| AI | Groq (Llama 3.3 70B + Llama 4 Scout vision) | Fast, free tier, handles both text and image input |
| PDF parsing | pdf-parse | Reliable text extraction from text-based PDFs |
| PPTX parsing | JSZip | A .pptx is just a zip. Parse the XML directly, no heavy dependencies |
| Styling | Tailwind CSS + CSS custom properties | Token-based theming for clean dark/light switching |
| Storage | localStorage | Zero infrastructure, zero friction. Trade-off: no cross-device sync |
| Deployment | Vercel | One push, it's live |

---

## How the card generation works

Two-pass pipeline on every upload:

1. **Topic extraction** — first call identifies the main sections and themes in the document
2. **Card generation** — second call generates structured cards across three types: concept, definition, example

The prompt engineering here matters. Cards are explicitly instructed to cover relationships, edge cases, and "why" questions — not just definitions scraped from the surface.

Generation modes:
- **Quick** — 10 cards, fast overview
- **Standard** — 20 cards, balanced coverage
- **Deep** — 35 cards, comprehensive

---

## How spaced repetition works

SM-2 algorithm. Same one behind Anki.

Every card tracks:
- `repetitions` — how many times recalled correctly in sequence
- `easeFactor` — starts at 2.5, adjusts based on rating
- `interval` — days until next review
- `nextReview` — exact date scheduled

Rating scale: Blackout / Again / Hard / Good / Easy (0, 2, 3, 4, 5)

Wrong answer → interval resets to 1 day
Correct answer → interval multiplies by easeFactor

A card is mastered only when `repetitions >= 3` — meaning correct recall across at least three separate spaced sessions.

---

## Running locally

```bash
git clone https://github.com/sahooananya/imprint-flashcard.git
cd imprint-flashcard
npm install
```

Create `.env.local`:
```
YOUR_API_KEY=your_key_value_here
```

Get a free key at **[console.groq.com](https://console.groq.com)**

```bash
npm run dev
```

Open `http://localhost:3000`

---

## What I'd build next

- Optional user accounts with cloud sync
- Better document parsing — chunk by section, not raw character count
- Topic-level selection before generation ("generate cards from Chapter 3 only")
- Review heatmap and time-per-card analytics
- Calendar view for upcoming review dates

---

## Project structure

```
imprint-flashcard/
├── app/
│   ├── api/generate/route.js    ← PDF/PPTX/image extraction + card generation
│   ├── deck/[id]/page.js        ← Study page — all four modes
│   ├── page.js                  ← Home — upload, deck management
│   └── globals.css              ← Theme tokens, card flip, animations
├── lib/
│   ├── sm2.js                   ← Spaced repetition algorithm
│   ├── storage.js               ← localStorage read/write
│   └── motivate.js              ← Contextual motivational messages
```

Built by **Ananya Sahoo** as part of the Cuemath AI Builder Challenge — April 2026.