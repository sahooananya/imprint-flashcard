'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDeck, updateCard, saveDeck } from '../../../lib/storage';
import { sm2, getDueCards, getMastery, getCardStatus, getNextReviewText, getWeakTopics, updateStreak } from '../../../lib/sm2';
import { getMotivation } from '../../../lib/motivate';

const RATING_CONFIG = [
  { quality: 0, label: 'Blackout', sublabel: 'No idea',          color: 'rose'   },
  { quality: 2, label: 'Again',    sublabel: 'Felt familiar',     color: 'rose'   },
  { quality: 3, label: 'Hard',     sublabel: 'Got it barely',     color: 'muted'  },
  { quality: 4, label: 'Good',     sublabel: 'Slight hesitation', color: 'amber'  },
  { quality: 5, label: 'Easy',     sublabel: 'Instant recall',    color: 'sage'   },
];

const ratingStyle = (color) => {
  const map = {
    rose:  { border: 'rgba(201,122,122,0.8)', glow: 'rgba(201,122,122,0.2)', text: 'var(--rose)' },
    muted: { border: 'var(--border-soft)',     glow: 'rgba(139,163,197,0.15)', text: 'var(--text-muted)' },
    amber: { border: 'rgba(232,168,66,0.8)',   glow: 'rgba(232,168,66,0.2)', text: 'var(--amber-soft)' },
    sage:  { border: 'rgba(125,171,130,0.8)',  glow: 'rgba(125,171,130,0.2)', text: 'var(--sage)' },
  };
  const c = map[color] || map.muted;
  return {
    border: `2px solid ${c.border}`,
    color: c.text,
    background: 'var(--bg-raised)',
    borderRadius: 12,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    padding: '10px 4px',
    textAlign: 'center',
    boxShadow: `0 0 0 0px ${c.glow}`,
  };
};

const TEST_DURATIONS = [
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
];

function Confetti() {
  const colors = ['#e8a842','#7dab82','#f2bc68','#c97a7a','#f0ebe2'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 55 }).map((_, i) => (
        <div key={i} className="absolute animate-bounce" style={{
          left: `${Math.random() * 100}%`,
          top: `-${Math.random() * 20 + 5}%`,
          width: `${Math.random() * 9 + 4}px`,
          height: `${Math.random() * 9 + 4}px`,
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animationDuration: `${Math.random() * 2 + 1}s`,
          animationDelay: `${Math.random() * 0.6}s`,
        }} />
      ))}
    </div>
  );
}

function generateMCQOptions(card, allCards) {
  const distractors = allCards
    .filter((c) => c.id !== card.id && c.answer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((c) => c.answer);
  while (distractors.length < 3) distractors.push('None of the above');
  return [card.answer, ...distractors].sort(() => Math.random() - 0.5);
}

export default function DeckPage() {
  const { id }   = useParams();
  const router   = useRouter();

  const [deck,           setDeck]           = useState(null);
  const [queue,          setQueue]          = useState([]);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [flipped,        setFlipped]        = useState(false);
  const [sessionStats,   setSessionStats]   = useState({ reviewed: 0, correct: 0, prevMastery: 0 });
  const [pageMode,       setPageMode]       = useState('launcher');
  const [studyMode,      setStudyMode]      = useState('flashcard');
  const [testDuration,   setTestDuration]   = useState(300);
  const [timeLeft,       setTimeLeft]       = useState(null);
  const [showConfetti,   setShowConfetti]   = useState(false);
  const [motivation,     setMotivation]     = useState('');
  const [mcqOptions,     setMcqOptions]     = useState([]);
  const [mcqSelected,    setMcqSelected]    = useState(null);
  const [mcqRevealed,    setMcqRevealed]    = useState(false);
  const [theme,          setTheme]          = useState('dark');
  const [recallInput,    setRecallInput]    = useState('');
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [direction,      setDirection]      = useState('forward');

  const timerRef  = useRef(null);
  const recallRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('fe_theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('fe_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    const d = getDeck(id);
    if (!d) { router.push('/'); return; }
    setDeck(d);
    setSessionStats((s) => ({ ...s, prevMastery: getMastery(d.cards) }));
    setMotivation(getMotivation('start'));
  }, [id]);

  const currentCard = queue[currentIndex];
  const mastery     = deck ? getMastery(deck.cards) : 0;
  const weakTopics  = deck ? getWeakTopics(deck.cards) : [];
  const accuracy    = sessionStats.reviewed
    ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 100;

  useEffect(() => {
    if (studyMode === 'mcq' && currentCard && deck) {
      setMcqOptions(generateMCQOptions(currentCard, deck.cards));
      setMcqSelected(null);
      setMcqRevealed(false);
    }
    if (studyMode === 'recall') {
      setRecallInput('');
      setRecallRevealed(false);
    }
  }, [currentIndex, studyMode, currentCard]);

  useEffect(() => {
    if (!currentCard) return;
    const remaining = queue.length - currentIndex;
    const ctx = accuracy < 50 ? 'struggling' : accuracy >= 75 ? 'doing_well' : 'start';
    setMotivation(getMotivation(
      studyMode === 'mcq' ? 'mcq' : studyMode === 'test' ? 'test_mode' : ctx,
      accuracy, remaining
    ));
  }, [currentIndex]);

  useEffect(() => {
    if (pageMode === 'test' && timeLeft !== null) {
      if (timeLeft <= 0) { clearInterval(timerRef.current); finishSession(); return; }
      timerRef.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [pageMode, timeLeft]);

  const startStudy = (mode) => {
    const due   = getDueCards(deck.cards);
    const cards = due.length > 0 ? due : deck.cards;
    setQueue(cards.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setFlipped(false);
    setStudyMode(mode);
    setRecallInput('');
    setRecallRevealed(false);
    setDirection('forward');
    setSessionStats({ reviewed: 0, correct: 0, prevMastery: getMastery(deck.cards) });
    setShowConfetti(false);
    if (mode === 'test') { setTimeLeft(testDuration); setPageMode('test'); }
    else setPageMode('study');
  };

  const finishSession = useCallback(() => {
    clearInterval(timerRef.current);
    updateStreak();
    const final = getDeck(id);
    if (final) { final.lastStudied = new Date().toISOString(); saveDeck(final); }
    if (deck && getMastery(deck.cards) === 100) setShowConfetti(true);
    setPageMode('done');
  }, [id, deck]);

  const advanceCard = useCallback((isCorrect, dir = 'forward') => {
    setDirection(dir);
    setSessionStats((prev) => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));
    setFlipped(false);
    setMcqSelected(null);
    setMcqRevealed(false);
    setRecallInput('');
    setRecallRevealed(false);
    setTimeout(() => {
      if (dir === 'forward') {
        if (currentIndex + 1 >= queue.length) finishSession();
        else setCurrentIndex((i) => i + 1);
      } else {
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    }, studyMode === 'mcq' ? 800 : 250);
  }, [currentIndex, queue.length, finishSession, studyMode]);

  const handleRate = useCallback((quality) => {
    if (!currentCard || !deck) return;
    if (pageMode !== 'test') {
      const updates     = sm2(currentCard, quality);
      const updatedDeck = updateCard(deck.id, currentCard.id, updates);
      setDeck(updatedDeck);
    }
    advanceCard(quality >= 3);
  }, [currentCard, deck, pageMode, advanceCard]);

  const handleMCQ = (option) => {
    if (mcqRevealed) return;
    setMcqSelected(option);
    setMcqRevealed(true);
    const isCorrect = option === currentCard.answer;
    if (pageMode !== 'test' && isCorrect) {
      const updates = sm2(currentCard, 4);
      setDeck(updateCard(deck.id, currentCard.id, updates));
    }
    setTimeout(() => advanceCard(isCorrect), 800);
  };

  const jumpToCard = (i) => {
    setDirection(i > currentIndex ? 'forward' : 'backward');
    setFlipped(false);
    setMcqSelected(null);
    setMcqRevealed(false);
    setRecallInput('');
    setRecallRevealed(false);
    setCurrentIndex(i);
  };

  useEffect(() => {
    const handler = (e) => {
      if (pageMode !== 'study' && pageMode !== 'test') return;
      if (studyMode === 'mcq') return;
      if (studyMode === 'recall' && document.activeElement === recallRef.current) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (studyMode === 'recall') {
          if (!recallRevealed) setRecallRevealed(true);
          else setFlipped((f) => !f);
        } else {
          setFlipped((f) => !f);
        }
      }
      if (flipped || (studyMode === 'recall' && recallRevealed)) {
        if (e.key === '1') handleRate(0);
        if (e.key === '2') handleRate(2);
        if (e.key === '3') handleRate(3);
        if (e.key === '4') handleRate(4);
        if (e.key === '5') handleRate(5);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, pageMode, studyMode, handleRate, recallRevealed]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const S = {
    label: {
      fontFamily: '"JetBrains Mono", monospace',
      color: 'var(--text-faint)',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
    },
    cardQuestion: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 500,
      color: 'var(--text-primary)',
      fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)',
      lineHeight: 1.6,
      letterSpacing: '0.01em',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      hyphens: 'auto',
      maxWidth: '100%',
    },
    cardAnswer: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      color: 'var(--text-primary)',
      fontSize: '0.9875rem',
      lineHeight: 1.75,
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      hyphens: 'auto',
      maxWidth: '100%',
    },
    badge: {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
      borderRadius: 9999,
      padding: '3px 10px',
      border: '1px solid var(--border)',
      background: 'var(--bg-raised)',
      color: 'var(--text-muted)',
      letterSpacing: '0.05em',
    },
    surface: {
      background: 'var(--bg-card)',
      border: '1.5px solid var(--border)',
      borderRadius: 18,
      boxShadow: 'var(--card-shadow)',
    },
    btn: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      fontSize: '0.875rem',
      borderRadius: 10,
      padding: '10px 20px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: '1.5px solid var(--border)',
      background: 'var(--bg-raised)',
      color: 'var(--text-secondary)',
    },
    btnPrimary: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      fontSize: '0.9rem',
      letterSpacing: '0.03em',
      borderRadius: 10,
      padding: '10px 24px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      background: 'var(--accent)',
      color: 'var(--bg)',
    },
  };

  if (!deck) return (
    <div className="min-h-screen flex items-center justify-center">
      <div style={{ border: '2px solid var(--amber)', borderTopColor: 'transparent', borderRadius: '50%', width: 32, height: 32 }} className="animate-spin" />
    </div>
  );


  if (pageMode === 'launcher') {
    const due = getDueCards(deck.cards).length;
    return (
      <div className="min-h-screen px-5 py-10 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button onClick={() => router.push('/')} style={{ ...S.label, cursor: 'pointer' }}>← Back</button>
          <button onClick={toggleTheme} style={{ ...S.btn, padding: '6px 14px', fontSize: 12 }}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <h2 style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', lineHeight: 1.25 }} className="text-4xl mb-2">{deck.title}</h2>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono' }} className="text-sm mb-3">
          {deck.cards.length} cards · {mastery}% mastered
          {due > 0 && <span style={{ color: 'var(--amber-soft)' }}> · {due} due today</span>}
        </p>

        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '2px solid var(--amber-dim)', paddingLeft: 14, marginBottom: 32, fontSize: 14 }}>
          "{motivation}"
        </p>

        {weakTopics.length > 0 && (
          <div style={{ background: 'rgba(201,122,122,0.06)', border: '1px solid rgba(201,122,122,0.2)', borderRadius: 14 }} className="p-4 mb-6">
            <p style={{ ...S.label, color: 'var(--rose)', marginBottom: 10 }}>⚠ Weak Areas</p>
            {weakTopics.map((wt) => (
              <div key={wt.topic} className="flex justify-between items-center py-1">
                <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{wt.topic}</span>
                <span style={{ color: 'var(--rose)', fontFamily: 'DM Mono', fontSize: 12 }}>{wt.accuracy}% accuracy</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <button onClick={() => startStudy('flashcard')}
            className="hover-lift"
            style={{ ...S.surface, padding: 20, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--amber-dim)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <p style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: 4 }}>🃏 Flashcard Review</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Study at your own pace. Rate each card — harder ones come back sooner.</p>
            {due > 0 && <p style={{ color: 'var(--amber-soft)', fontFamily: 'DM Mono', fontSize: 12, marginTop: 6 }}>{due} cards due today</p>}
          </button>

          <button onClick={() => startStudy('recall')}
            className="hover-lift"
            style={{ ...S.surface, padding: 20, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease', borderColor: 'rgba(125,171,130,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sage)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(125,171,130,0.3)'; }}>
            <p style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: 4 }}>✍️ Active Recall</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Write your answer before seeing it. The harder you think, the better it sticks.</p>
          </button>

          <button onClick={() => startStudy('mcq')}
            className="hover-lift"
            style={{ ...S.surface, padding: 20, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease', borderColor: 'rgba(125,171,130,0.2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sage)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(125,171,130,0.2)'; }}>
            <p style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: 4 }}>❓ MCQ Practice</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Pick the right answer from 4 options. Good for quick revision and recognition.</p>
          </button>

          <div className="hover-lift"  style={{ ...S.surface, padding: 20, borderColor: 'rgba(201,122,122,0.2)' }}>
            <p style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: 4 }}>⏱ Test Mode</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>Set a timer and go through your deck. No pressure — just see where you stand.</p>
            <div className="flex gap-2 mb-4">
              {TEST_DURATIONS.map((d) => (
                <button key={d.seconds} onClick={() => setTestDuration(d.seconds)}
                  style={{
                    fontFamily: 'DM Mono', fontSize: 12, borderRadius: 9999, padding: '5px 14px', cursor: 'pointer',
                    border: `1px solid ${testDuration === d.seconds ? 'var(--rose)' : 'var(--border)'}`,
                    background: testDuration === d.seconds ? 'rgba(201,122,122,0.12)' : 'var(--bg-raised)',
                    color: testDuration === d.seconds ? 'var(--rose)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
            <button onClick={() => startStudy('test')}
              style={{ width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(201,122,122,0.4)', background: 'rgba(201,122,122,0.08)', color: 'var(--rose)', fontFamily: 'DM Mono', fontSize: 13, transition: 'all 0.15s' }}>
              Start {TEST_DURATIONS.find((d) => d.seconds === testDuration)?.label} Test
            </button>
          </div>
        </div>

        <button onClick={() => setPageMode('overview')} style={{ ...S.btn, width: '100%', textAlign: 'center', fontSize: 13 }}>
          📋 Browse all cards
        </button>
      </div>
    );
  }


  if (pageMode === 'overview') {
    const byStatus = {
      new:        deck.cards.filter((c) => getCardStatus(c) === 'new'),
      struggling: deck.cards.filter((c) => getCardStatus(c) === 'struggling'),
      learning:   deck.cards.filter((c) => getCardStatus(c) === 'learning'),
      mastered:   deck.cards.filter((c) => getCardStatus(c) === 'mastered'),
    };
    const statusColor = { new: 'var(--text-muted)', struggling: 'var(--rose)', learning: 'var(--amber-soft)', mastered: 'var(--sage)' };
    return (
      <div className="min-h-screen px-5 py-12 max-w-3xl mx-auto">
        <button onClick={() => setPageMode('launcher')} style={{ ...S.label, cursor: 'pointer', display: 'block', marginBottom: 32 }}>← Back</button>
        <h2 style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }} className="text-3xl mb-8">{deck.title}</h2>
        {Object.entries(byStatus).map(([status, cards]) => cards.length > 0 && (
          <div key={status} className="mb-8">
            <p style={{ ...S.label, color: statusColor[status], marginBottom: 12 }}>{status} · {cards.length}</p>
            <div className="flex flex-col gap-2">
              {cards.map((c) => (
                <div key={c.id} style={{ ...S.surface, padding: '16px 20px' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div style={{ flex: 1 }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: 14, marginBottom: 6, lineHeight: 1.5 }}>{c.question}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>{c.answer}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11 }}>{getNextReviewText(c)}</p>
                      <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 10, marginTop: 2 }}>{c.type || 'concept'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // completion pg
  if (pageMode === 'done') {
    const improvement = mastery - sessionStats.prevMastery;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center animate-fade-in">
        {showConfetti && <Confetti />}
        <div className="text-6xl mb-5">{accuracy >= 80 ? '🎯' : accuracy >= 50 ? '📈' : '💪'}</div>
        <h2 style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }} className="text-4xl mb-2">
          {studyMode === 'test' ? 'Test complete' : 'Session complete'}
        </h2>
        <p style={{ color: 'var(--text-muted)' }} className="mb-2">{sessionStats.reviewed} cards · {accuracy}% accuracy</p>
        {studyMode === 'test' && (
          <p style={{ color: 'var(--rose)', fontFamily: 'DM Mono', fontSize: 12, marginBottom: 12 }}>
            Test mode — SM-2 not updated. Run a review session to schedule cards.
          </p>
        )}
        {improvement > 0 && (
          <p style={{ color: 'var(--sage)', fontFamily: 'DM Mono', fontSize: 13, marginBottom: 12 }} className="animate-fade-in">
            ↑ Mastery {sessionStats.prevMastery}% → {mastery}%
          </p>
        )}
        <div style={{ background: 'var(--bg-raised)', borderRadius: 9999, height: 6, width: 200, marginBottom: 6 }}>
          <div style={{ width: `${mastery}%`, background: 'var(--amber)', borderRadius: 9999, height: 6 }} className="progress-bar" />
        </div>
        <p style={{ color: 'var(--amber-soft)', fontFamily: 'DM Mono', fontSize: 13, marginBottom: 24 }}>{mastery}% overall mastered</p>
        {weakTopics.length > 0 && (
          <div style={{ ...S.surface, padding: '14px 18px', textAlign: 'left', maxWidth: 280, width: '100%', marginBottom: 28 }}>
            <p style={{ ...S.label, color: 'var(--rose)', marginBottom: 8 }}>Focus next time</p>
            {weakTopics.map((wt) => (
              <p key={wt.topic} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                · {wt.topic} <span style={{ color: 'var(--rose)' }}>({wt.accuracy}%)</span>
              </p>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => setPageMode('launcher')} style={S.btn}>← Back</button>
          <button onClick={() => router.push('/')} style={S.btn}>All Decks</button>
          <button onClick={() => startStudy(studyMode)} style={S.btnPrimary}>Again</button>
        </div>
      </div>
    );
  }


  const progress    = queue.length ? (currentIndex / queue.length) * 100 : 0;
  const typeIcon    = { concept: '💡', definition: '📖', example: '🔢' };
  const isTest      = pageMode === 'test';
  const showRatings = studyMode === 'flashcard' ? flipped
    : studyMode === 'recall' ? recallRevealed
    : false;

  return (
    <div className="min-h-screen flex flex-col px-5 py-8 max-w-2xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setPageMode('launcher')} style={{ ...S.label, cursor: 'pointer' }}>← Back</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{deck.title}</p>
          <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11 }}>
            {currentIndex + 1} / {queue.length}
            {isTest && <span style={{ color: 'var(--rose)', marginLeft: 8 }}>⏱ {formatTime(timeLeft)}</span>}
            {studyMode !== 'flashcard' && (
              <span style={{ color: 'var(--text-faint)', marginLeft: 8 }}>
                · {studyMode === 'recall' ? '✍️ recall' : studyMode === 'mcq' ? '❓ mcq' : ''}
              </span>
            )}
          </p>
        </div>
        <button onClick={toggleTheme} style={{ ...S.btn, padding: '5px 12px', fontSize: 11 }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Timer bar */}
      {isTest && (
        <div style={{ background: 'var(--bg-raised)', borderRadius: 9999, height: 3, marginBottom: 6 }}>
          <div style={{ width: `${(timeLeft / testDuration) * 100}%`, background: 'var(--rose)', borderRadius: 9999, height: 3, transition: 'width 1s linear' }} />
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background: 'var(--bg-raised)', borderRadius: 9999, height: 4, marginBottom: 24 }}>
        <div style={{ width: `${progress}%`, background: 'var(--amber)', borderRadius: 9999, height: 4 }} className="progress-bar" />
      </div>

      {/* Motivation */}
      <p style={{ color: 'var(--text-faint)', fontStyle: 'italic', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
        "{motivation}"
      </p>

      {/* Badges */}
      {currentCard && (
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {currentCard.type && (
            <span style={{ ...S.badge }}>{typeIcon[currentCard.type] || '💡'} {currentCard.type}</span>
          )}
          {currentCard.topic && (
            <span style={{ ...S.badge, borderColor: 'rgba(232,168,66,0.3)', color: 'var(--amber-dim)' }}>{currentCard.topic}</span>
          )}
          {isTest && <span style={{ ...S.badge, borderColor: 'rgba(201,122,122,0.3)', color: 'var(--rose)' }}>test</span>}
        </div>
      )}


      {studyMode === 'mcq' && currentCard ? (
        <div className="flex-1 flex flex-col gap-4">
          <div
            key={`mcq-q-${currentIndex}`}
            className={direction === 'forward' ? 'slide-forward' : 'slide-backward'}
            style={{ ...S.surface, padding: '2rem', textAlign: 'center', flex: 'none' }}>
            <p style={{ ...S.label, marginBottom: 16 }}>Question</p>
            <p style={S.cardQuestion}>{currentCard.question}</p>
          </div>
          <div
            key={`mcq-opts-${currentIndex}`}
            className={`flex flex-col gap-2 ${direction === 'forward' ? 'slide-forward' : 'slide-backward'}`}>
            {mcqOptions.map((option, i) => {
              let extra = {};
              if (mcqRevealed) {
                if (option === currentCard.answer)  extra = { borderColor: 'var(--sage)', background: 'rgba(125,171,130,0.1)', color: 'var(--sage)' };
                else if (option === mcqSelected)    extra = { borderColor: 'var(--rose)', background: 'rgba(201,122,122,0.08)', color: 'var(--rose)' };
                else extra = { opacity: 0.45 };
              }
              return (
                <button key={i} onClick={() => handleMCQ(option)} disabled={mcqRevealed}
                  className="mcq-option" style={{ ...extra }}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-faint)', marginRight: 10 }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>

      /* input space */
      ) : studyMode === 'recall' && currentCard ? (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in">
          <div style={{ ...S.surface, padding: '2.5rem', textAlign: 'center' }}>
            <p style={{ ...S.label, marginBottom: 18 }}>Question</p>
            <p style={S.cardQuestion}>{currentCard.question}</p>
          </div>
          {!recallRevealed && (
            <div className="animate-fade-in">
              <textarea
                ref={recallRef}
                value={recallInput}
                onChange={(e) => setRecallInput(e.target.value)}
                placeholder="Type your answer (optional)…"
                className="recall-input"
                rows={3}
              />
              <button onClick={() => setRecallRevealed(true)}
                style={{ ...S.btnPrimary, width: '100%', marginTop: 10, textAlign: 'center', fontSize: 14 }}>
                Reveal Answer {recallInput.trim() ? '& Compare' : ''}
              </button>
              <p style={{ ...S.label, textAlign: 'center', marginTop: 8 }}>or press space</p>
            </div>
          )}
          {recallRevealed && (
            <div className="animate-fade-in">
              {recallInput.trim() && (
                <div style={{ ...S.surface, padding: '1.25rem 1.5rem', marginBottom: 10, borderColor: 'rgba(125,171,130,0.3)' }}>
                  <p style={{ ...S.label, marginBottom: 8, color: 'var(--sage)' }}>Your answer</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>{recallInput}</p>
                </div>
              )}
              <div style={{ ...S.surface, padding: '1.5rem', borderColor: 'var(--amber-dim)' }}>
                <p style={{ ...S.label, marginBottom: 12, color: 'var(--amber-dim)' }}>Correct Answer</p>
                <p style={S.cardAnswer}>{currentCard.answer}</p>
                {currentCard.lastReviewed && (
                  <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11, marginTop: 14 }}>
                    {getNextReviewText(currentCard)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      /* deck */
      ) : currentCard ? (
        <div className={`flip-card flex-1 ${flipped ? 'flipped' : ''}`}
          style={{ minHeight: 300 }}
          onClick={() => setFlipped((f) => !f)}>
          <div className="flip-card-inner">
            <div className="flip-card-front">
              <p style={{ ...S.label, marginBottom: 20 }}>Question</p>
              <p style={S.cardQuestion}>{currentCard.question}</p>
              <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11, marginTop: 28 }}>tap or press space to reveal</p>
            </div>
            <div className="flip-card-back">
              <p style={{ ...S.label, color: 'var(--amber-dim)', marginBottom: 20 }}>Answer</p>
              <p style={S.cardAnswer}>{currentCard.answer}</p>
              {currentCard.lastReviewed && (
                <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11, marginTop: 20 }}>
                  {getNextReviewText(currentCard)}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* rating area */}
      <div style={{ marginTop: 24, transition: 'all 0.3s ease', opacity: showRatings ? 1 : 0, transform: showRatings ? 'translateY(0)' : 'translateY(12px)', pointerEvents: showRatings ? 'auto' : 'none' }}>
        <p style={{ ...S.label, textAlign: 'center', marginBottom: 12 }}>How well did you know it?</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {RATING_CONFIG.map(({ quality, label, sublabel, color }) => (
            <button key={quality}
              onClick={(e) => { e.stopPropagation(); handleRate(quality); }}
              style={ratingStyle(color)}>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, fontWeight: 500 }}>{label}</div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 10, opacity: 0.55, marginTop: 2 }} className="hidden sm:block">{sublabel}</div>
            </button>
          ))}
        </div>
        <p style={{ ...S.label, textAlign: 'center', marginTop: 10 }}>space to flip · 1–5 to rate</p>
      </div>


      {isTest && (
        <div className="flex justify-between items-center mt-5">
          <button
            onClick={() => advanceCard(false, 'backward')}
            disabled={currentIndex === 0}
            style={{ ...S.btn, opacity: currentIndex === 0 ? 0.3 : 1, fontSize: 13, padding: '8px 16px' }}>
            ← Prev
          </button>
          <button
            onClick={() => advanceCard(false, 'forward')}
            style={{ ...S.btnPrimary, fontSize: 13, padding: '8px 20px' }}>
            Next →
          </button>
        </div>
      )}

      {/* pill */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 }}>
        {queue.map((_, i) => (
          <button key={i} onClick={() => jumpToCard(i)}
            style={{
              width: 28, height: 28, borderRadius: '50%', fontSize: 11,
              fontFamily: 'DM Mono', cursor: 'pointer', transition: 'all 0.15s',
              background: i === currentIndex ? 'var(--amber)' : i < currentIndex ? 'var(--bg-card)' : 'var(--bg-raised)',
              border: `1.5px solid ${i === currentIndex ? 'var(--amber)' : 'var(--border)'}`,
              color: i === currentIndex ? '#1a1612' : i < currentIndex ? 'var(--text-muted)' : 'var(--text-faint)',
            }}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Session stats */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, color: 'var(--text-faint)', fontFamily: 'DM Mono', fontSize: 11 }}>
        <span>{sessionStats.reviewed} reviewed</span>
        <span>{accuracy}% accuracy</span>
        <span>{mastery}% mastered</span>
      </div>
    </div>
  );
}
