<h1 align="center">Imprint</h1>

<p align="center">
  <em>Leave a mark on your memory. Built for the long game.</em>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq_Llama_3.3-FF6B35?style=for-the-badge&logo=meta&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/SM--2_Algorithm-4CAF50?style=for-the-badge&logo=bookstack&logoColor=white" />
</p>

<p align="center">
  <a href="https://imprint-flashcard.vercel.app"><strong>→ Try it live</strong></a>
</p>

---

## What is Imprint?

Most flashcard apps are just card flippers. You flip, you read, you move on. That's recognition — not recall. And recognition fades fast.

Imprint is built around a different belief: **the act of retrieving information is what makes it stick.** Not re-reading. Not passively flipping. Actually pulling the answer out of your head — under mild pressure, spaced over time.

Every decision in this project came from that belief.

---

## What it does

### Upload anything
Drop in a PDF, a PowerPoint (.pptx), or a photo of your notes. Imprint extracts the content and generates flashcards covering concepts, definitions, and worked examples — not just surface facts.

| Mode | Cards | Best for |
|------|-------|----------|
| ⚡ Quick | 10 | Fast overview |
| 📖 Standard | 20 | Balanced coverage |
| 🧠 Deep | 35 | Comprehensive study |

---

### Four study modes

| Mode | What it does |
|------|-------------|
| 🃏 Flashcard Review | Flip and rate. SM-2 schedules what comes next |
| ✍️ Active Recall | Type your answer before the reveal. Forces real retrieval |
| ❓ MCQ Practice | 4 options per card. Distractors pulled from your own deck — no extra API call |
| ⏱ Test Mode | Timed session (3 / 5 / 10 min). SM-2 not updated — pure assessment |

---

### Spaced repetition — SM-2

Every card has its own ease factor and interval that adjusts independently based on performance.

```
Rate "Easy"    → card fades for weeks
Rate "Hard"    → card is back tomorrow  
Rate "Blackout"→ resets to 1 day
```

**Mastery ≠ accuracy.** A card is mastered only after correct recall across **3 separate sessions on different days.** One good run doesn't count.

---

### Progress that means something

- Per-deck mastery percentage with progress bar
- Weak area detection — shows which topics you're struggling with by accuracy
- Next review date on every card after flip
- Improvement message at session end — "Mastery 40% → 65%"
- Daily streak counter
- Confetti on 100% mastery

---

### Deck management

- Search by name, filter by All / Due / Recent / Mastered
- Topics shown as tags per deck
- Card type breakdown per deck: 💡 Concept · 📖 Definition · 🔢 Example
- Resume indicator on previously studied decks
- Dark and light mode — persists across sessions

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 | API routes keep the Groq key server-side — never exposed to browser |
| AI — Text | Groq Llama 3.3 70B | Fast, free tier, excellent output quality |
| AI — Vision | Groq Llama 4 Scout | Extracts text from image uploads |
| PDF | pdf-parse | Reliable text extraction |
| PPTX | JSZip | A .pptx is a zip archive — parse slide XML directly, no ESM conflicts |
| Styling | Tailwind CSS + CSS custom properties | Token-based dark/light theming |
| Storage | localStorage | Zero infrastructure, instant start. Trade-off: no cross-device sync |
| Deployment | Vercel | One push, live in minutes |

---

## How card generation works

Two API calls per upload:

```
Upload file
    ↓
Extract text (PDF / PPTX XML / Groq vision for images)
    ↓
Pass 1 — extract main topics from content
    ↓
Pass 2 — generate cards (concept + definition + example mix)
    ↓
SM-2 defaults applied → deck ready
```

Cards are explicitly prompted to cover relationships, edge cases, and "why" questions — not just definitions scraped from the surface.

---

## How spaced repetition works

SM-2 algorithm — the same one behind Anki.

Every card tracks:
- `repetitions` — correct recalls in sequence
- `easeFactor` — starts at 2.5, adjusts per rating
- `interval` — days until next review
- `nextReview` — exact scheduled date

Rating scale: **Blackout (0) / Again (2) / Hard (3) / Good (4) / Easy (5)**

Wrong answer → interval resets to 1 day
Correct answer → interval × easeFactor

---

## Running locally

```bash
git clone https://github.com/sahooananya/imprint-flashcard.git
cd imprint-flashcard
npm install
```

Create `.env.local`:
```
your_API_KEY = your_key_value_here
```

Get a free key at [console.groq.com](https://console.groq.com)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---
## Updates comming up next--->

- User accounts with cloud sync
- Better document parsing — chunk by section, detect headings and structure
- Topic-level card generation — pick which section to generate from
- Review heatmap and time-per-card analytics
- Calendar view for upcoming review dates

---

<p align="center">
  Built by <strong>Ananya Sahoo</strong> · Cuemath AI Builder Challenge · April 2026
</p>