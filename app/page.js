'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { getAllDecks, saveDeck, deleteDeck } from '../lib/storage';
import { getMastery, getDueCards, getStreak } from '../lib/sm2';
import MotivationBubble from '../components/bubble';

const MODES = [
  { id: 'quick',    label: 'Quick',    desc: '10 cards', icon: '⚡' },
  { id: 'standard', label: 'Standard', desc: '20 cards', icon: '📖' },
  { id: 'deep',     label: 'Deep',     desc: '35 cards', icon: '🧠' },
];
const FILTERS = ['all', 'due', 'recent', 'mastered'];
const ACCEPT  = '.pdf,.ppt,.pptx,image/jpeg,image/png,image/webp';

const DAILY_QUOTES = [
  "Let today be the day you become who you've been trying to become.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "The person you'll be in five years is built by the hours you put in today.",
  "Every expert was once a beginner who refused to quit.",
  "Knowledge unused is knowledge lost. Review today.",
  "Small daily improvements are the magic of remarkable results.",
  "Your brain is not a hard drive. Train it like a muscle.",
  "One more card. One more step closer to knowing it cold.",
  "Consistency is the rarest and most valuable of human commodities.",
  "The gap between who you are and who you want to be is what you do daily.",
  "Struggle is the curriculum. Difficulty is the lesson.",
  "Champions don't show up to feel motivated. They show up and motivation follows.",
  "What you learn today under pressure, you remember forever.",
  "Repetition is not failure. It's how mastery is built.",
  "Study hard in silence. Let your knowledge make the noise.",
];

const MARQUEE_ITEMS = [
  'STUDY', 'LEARN', 'IMPRINT', 'MASTER', 'RECALL', 'RETAIN', 'GROW', 'REVIEW',
  'STUDY', 'LEARN', 'IMPRINT', 'MASTER', 'RECALL', 'RETAIN', 'GROW', 'REVIEW',
];

function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return DAILY_QUOTES[dayIndex % DAILY_QUOTES.length];
}

function fmt(n) {
  return String(n).padStart(2, '0');
}

export default function Home() {
  const [decks,        setDecks]        = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragOver,     setDragOver]     = useState(false);
  const [deckName,     setDeckName]     = useState('');
  const [mode,         setMode]         = useState('standard');
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState('all');
  const [streak,       setStreak]       = useState(0);
  const [theme,        setTheme]        = useState('dark');
  const fileRef = useRef();
  const router  = useRouter();

  useEffect(() => {
    const all = getAllDecks();
    setDecks(Object.values(all).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setStreak(getStreak());
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

  const handleFile = async (file) => {
    const name = file?.name?.toLowerCase() || '';
    const allowed = file && (
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      name.endsWith('.pptx') || name.endsWith('.ppt') ||
      file.type.includes('presentationml') || file.type.includes('ms-powerpoint')
    );
    if (!allowed) { setUploadStatus('Upload a PDF, PowerPoint (.pptx), or image.'); return; }

    if (file.size > 4 * 1024 * 1024 && (name.endsWith('.pptx') || name.endsWith('.ppt'))) {
      setUploadStatus('PPTX must be under 4MB. Try fewer slides.');
      return;
    }

    let processedFile = file;
    if (file.type.startsWith('image/')) {
      processedFile = await new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX) { height = (height * MAX) / width; width = MAX; }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
            'image/jpeg', 0.82
          );
        };
        img.src = URL.createObjectURL(file);
      });
    }

    const deckTitle = deckName.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploading(true);
    const isPPT = name.endsWith('.pptx') || name.endsWith('.ppt');
    setUploadStatus(isPPT ? 'Reading slides…' : file.type.startsWith('image/') ? 'Reading image…' : 'Reading PDF…');

    try {
      const fd = new FormData();
      fd.append('file', processedFile);
      fd.append('mode', mode);
      setUploadStatus('Generating flashcards…');
      const res  = await fetch('/api/generate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const deck = {
        id: uuidv4(), title: deckTitle,
        createdAt: new Date().toISOString(),
        cards: data.cards, topics: data.topics || [], mode: data.mode,
        lastStudied: null,
      };
      saveDeck(deck);
      setDecks((prev) => [deck, ...prev]);
      setUploadStatus(`✓ ${data.cards.length} cards created!`);
      setDeckName('');
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (err) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this deck?')) return;
    deleteDeck(id);
    setDecks((prev) => prev.filter((d) => d.id !== id));
  };

  const filteredDecks = decks
    .filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    .filter((d) => {
      if (filter === 'due')      return getDueCards(d.cards).length > 0;
      if (filter === 'mastered') return getMastery(d.cards) === 100;
      if (filter === 'recent')   return new Date(d.createdAt) > new Date(Date.now() - 86400000 * 2);
      return true;
    });

  const totalDue = decks.reduce((acc, d) => acc + getDueCards(d.cards).length, 0);
  const totalCards = decks.reduce((acc, d) => acc + d.cards.length, 0);

  return (
    <main className="min-h-screen max-w-4xl mx-auto">

      {/* ── HERO HEADER ── */}
      <header className="px-6 pt-12 pb-0 animate-slide-up">
        <div className="flex items-start justify-between mb-8">
          <div style={{ flex: 1 }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <h1 style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontWeight: 700,
                fontSize: 'clamp(3.2rem, 7vw, 5.5rem)',
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                color: 'var(--text-primary)',
              }}>Imprint</h1>
              {/* Live badge */}
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sage)',
                border: '1px solid var(--sage)',
                borderRadius: 9999,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--sage)', display: 'inline-block' }}
                  className="animate-pulse-soft" />
                Live
              </span>
            </div>
            <p style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)',
              color: 'var(--text-muted)',
              letterSpacing: '0.01em',
              marginBottom: '0.75rem',
            }}>Leave a mark on your memory.</p>
            <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem', fontFamily: '"Syne", sans-serif' }}>
              PDF · PowerPoint · Image — smart flashcards in seconds.
            </p>
          </div>

          {/* Right column: controls + streak */}
          <div className="flex flex-col items-end gap-3 ml-6 shrink-0">
            <button onClick={toggleTheme}
              style={{
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 9999,
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                letterSpacing: '0.06em',
                padding: '6px 14px',
                background: 'var(--bg-raised)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
              {theme === 'dark' ? '☀ Light' : '☽ Dark'}
            </button>
            {streak > 0 && (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '10px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }} className="float">
                <span style={{ fontSize: 20 }}>🔥</span>
                <span style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontWeight: 700,
                  fontSize: '1.4rem',
                  color: 'var(--amber)',
                  lineHeight: 1,
                }}>{streak}</span>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {(totalCards > 0 || streak > 0) && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }} className="animate-fade-in">
            {totalCards > 0 && (
              <div>
                <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{totalCards}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>total cards</div>
              </div>
            )}
            {decks.length > 0 && (
              <div>
                <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{decks.length}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>decks</div>
              </div>
            )}
            {totalDue > 0 && (
              <div>
                <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', fontWeight: 700, color: 'var(--amber)', lineHeight: 1 }}>{totalDue}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>due today</div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── MARQUEE STRIP ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 0',
        margin: '0 0 32px 0',
        background: 'var(--bg-raised)',
        overflow: 'hidden',
      }} className="marquee-wrap">
        <div className="marquee-track">
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: i % 4 === 2 ? 'var(--amber)' : 'var(--text-faint)',
              marginRight: 36,
              userSelect: 'none',
            }}>
              {item}
              {i % 2 === 1 && <span style={{ marginLeft: 36, color: 'var(--border)' }}>·</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="px-6">
        {/* ── DUE BANNER ── */}
        {totalDue > 0 && (
          <div style={{
            background: 'var(--amber-dim)',
            border: '1px solid rgba(232,168,66,0.25)',
            borderRadius: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            marginBottom: 24,
          }} className="animate-fade-in">
            <div style={{ background: 'var(--amber)', borderRadius: '50%', width: 7, height: 7 }} className="animate-pulse-soft" />
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '12px', color: 'var(--amber-soft)' }}>
              {totalDue} card{totalDue !== 1 ? 's' : ''} due for review
            </span>
          </div>
        )}

        {/* ── DAILY QUOTE ── */}
        <div style={{
          borderLeft: '2px solid var(--amber-dim)',
          paddingLeft: 16,
          marginBottom: 32,
          color: 'var(--text-muted)',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          lineHeight: 1.65,
        }}>
          "{getDailyQuote()}"
        </div>

        {/* ── MODE SELECTOR ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
            Session depth
          </p>
          <div className="grid grid-cols-3 gap-2" style={{ animationDelay: '0.08s' }}>
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{
                  background: mode === m.id ? 'var(--bg-card)' : 'var(--bg-raised)',
                  border: `1.5px solid ${mode === m.id ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: 14,
                  color: mode === m.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '12px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em' }}>{m.label}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── UPLOAD DROPZONE ── */}
        <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.12s' }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--amber)' : 'var(--border-soft)'}`,
              background: dragOver ? 'var(--amber-dim)' : 'var(--bg-raised)',
              borderRadius: 20,
              cursor: uploading ? 'default' : 'pointer',
              transform: dragOver ? 'scale(1.015)' : 'scale(1)',
              transition: 'all 0.25s ease',
              padding: '48px 32px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
            {/* corner accents */}
            <div style={{ position: 'absolute', top: 12, left: 12, width: 18, height: 18, borderTop: '2px solid var(--border-soft)', borderLeft: '2px solid var(--border-soft)', borderRadius: '3px 0 0 0' }} />
            <div style={{ position: 'absolute', top: 12, right: 12, width: 18, height: 18, borderTop: '2px solid var(--border-soft)', borderRight: '2px solid var(--border-soft)', borderRadius: '0 3px 0 0' }} />
            <div style={{ position: 'absolute', bottom: 12, left: 12, width: 18, height: 18, borderBottom: '2px solid var(--border-soft)', borderLeft: '2px solid var(--border-soft)', borderRadius: '0 0 0 3px' }} />
            <div style={{ position: 'absolute', bottom: 12, right: 12, width: 18, height: 18, borderBottom: '2px solid var(--border-soft)', borderRight: '2px solid var(--border-soft)', borderRadius: '0 0 3px 0' }} />

            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => handleFile(e.target.files[0])} />
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ border: '2px solid var(--amber)', borderTopColor: 'transparent', borderRadius: '50%', width: 38, height: 38 }}
                  className="animate-spin" />
                <p style={{ color: 'var(--text-muted)', fontFamily: '"DM Mono", monospace', fontSize: '13px' }}>{uploadStatus}</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</p>
                <p style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '1.4rem',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>Drop your file here</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: '"Syne", sans-serif' }}>
                  PDF · PowerPoint (.pptx) · Image
                </p>
                {uploadStatus && (
                  <p style={{
                    color: uploadStatus.startsWith('✓') ? 'var(--sage)' : 'var(--rose)',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '13px',
                    marginTop: 12,
                  }}>{uploadStatus}</p>
                )}
              </div>
            )}
          </div>

          <input type="text" value={deckName} onChange={(e) => setDeckName(e.target.value)}
            placeholder="Deck name (optional — defaults to filename)"
            style={{
              background: 'var(--bg-raised)',
              border: '1.5px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              marginTop: 12,
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.9rem',
              fontFamily: '"Syne", sans-serif',
              transition: 'border-color 0.2s',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* ── DECKS ── */}
        {decks.length > 0 && (
          <>
            {/* Mastery explainer */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 28,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔁</span>
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem', fontFamily: '"Syne", sans-serif' }}>
                  Why isn't your deck 100% yet?
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.65, margin: 0, fontFamily: '"Syne", sans-serif' }}>
                  Remembering something once isn't knowing it. Mastery means you recalled it today, again in a few days, and again a week later — that's what actually sticks.
                </p>
              </div>
            </div>

            <section>
              {/* Section header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <h2 style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}>Your Decks</h2>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '11px', color: 'var(--text-faint)' }}>
                    {fmt(filteredDecks.length)} / {fmt(decks.length)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 9999,
                      color: 'var(--text-primary)',
                      fontFamily: '"DM Mono", monospace',
                      fontSize: '11px',
                      padding: '6px 14px',
                      width: 120,
                      outline: 'none',
                    }} />
                  {FILTERS.map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      style={{
                        background: filter === f ? 'var(--amber)' : 'var(--bg-raised)',
                        color: filter === f ? '#1a1612' : 'var(--text-muted)',
                        border: `1px solid ${filter === f ? 'var(--amber)' : 'var(--border)'}`,
                        borderRadius: 9999,
                        fontFamily: '"DM Mono", monospace',
                        fontSize: '11px',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredDecks.length === 0 && (
                <p style={{ color: 'var(--text-faint)', fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: '1.1rem' }}
                  className="text-center py-8">Nothing here yet — try a different filter.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
                {filteredDecks.map((deck, i) => {
                  const mastery = getMastery(deck.cards);
                  const due     = getDueCards(deck.cards).length;
                  const masteryColor =
                    mastery >= 80 ? 'var(--sage)' :
                    mastery >= 40 ? 'var(--amber-soft)' : 'var(--rose)';
                  const types = ['concept','definition','example'].map((t) => ({
                    t, count: deck.cards.filter((c) => c.type === t).length
                  })).filter((x) => x.count > 0);

                  return (
                    <div key={deck.id}
                      onClick={() => router.push(`/deck/${deck.id}`)}
                      className="group relative card-surface p-6 cursor-pointer animate-slide-up hover-lift"
                      style={{ animationDelay: `${i * 0.04}s` }}>

                      {/* index number */}
                      <span style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        fontFamily: '"DM Mono", monospace',
                        fontSize: '10px',
                        color: 'var(--text-faint)',
                        letterSpacing: '0.1em',
                      }}>{fmt(i + 1)}</span>

                      {/* delete */}
                      <button onClick={(e) => handleDelete(e, deck.id)}
                        style={{
                          color: 'var(--text-faint)',
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          fontSize: 20,
                          lineHeight: 1,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                        className="group-hover:opacity-100">×</button>

                      {/* title */}
                      <h3 style={{
                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        lineHeight: 1.25,
                        color: 'var(--text-primary)',
                        marginBottom: 6,
                        marginTop: 18,
                        paddingRight: 24,
                      }}>{deck.title}</h3>

                      <p style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', marginBottom: 12, letterSpacing: '0.06em' }}>
                        {deck.cards.length} cards · {new Date(deck.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {deck.mode && <span style={{ opacity: 0.6 }}> · {deck.mode}</span>}
                      </p>

                      {/* topics */}
                      {deck.topics?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {deck.topics.slice(0, 3).map((t) => (
                            <span key={t} style={{
                              background: 'var(--bg-raised)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              borderRadius: 9999,
                              fontFamily: '"DM Mono", monospace',
                              fontSize: '10px',
                              padding: '2px 8px',
                            }}>{t}</span>
                          ))}
                          {deck.topics.length > 3 && (
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '10px', color: 'var(--text-faint)', padding: '2px 0' }}>
                              +{deck.topics.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* card types */}
                      {types.length > 0 && (
                        <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                          {types.map(({ t, count }) => (
                            <span key={t} style={{ color: 'var(--text-muted)', fontFamily: '"DM Mono", monospace', fontSize: '10px' }}>
                              {t === 'concept' ? '💡' : t === 'definition' ? '📖' : '🔢'} {count}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Progress */}
                      <div style={{ background: 'var(--bg)', borderRadius: 9999, height: 4, marginBottom: 10 }}>
                        <div style={{ width: `${mastery}%`, background: 'var(--accent)', borderRadius: 9999, height: 4 }}
                          className="progress-bar" />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: masteryColor, fontFamily: '"DM Mono", monospace', fontSize: '11px' }}>
                          {mastery}% mastered
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {due > 0 && (
                            <span style={{
                              color: 'var(--amber-soft)',
                              background: 'var(--amber-dim)',
                              border: '1px solid rgba(232,168,66,0.22)',
                              borderRadius: 9999,
                              fontFamily: '"DM Mono", monospace',
                              fontSize: '10px',
                              padding: '2px 8px',
                            }}>{due} due</span>
                          )}
                          {deck.lastStudied && (
                            <span style={{ color: 'var(--text-faint)', fontFamily: '"DM Mono", monospace', fontSize: '10px' }}>↩ resume</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {decks.length === 0 && !uploading && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <p style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontStyle: 'italic',
              fontSize: '1.4rem',
              color: 'var(--text-faint)',
              marginBottom: 8,
            }}>Nothing here yet.</p>
            <p style={{ fontFamily: '"Syne", sans-serif', fontSize: '0.875rem', color: 'var(--text-faint)' }}>
              Upload a file above to create your first deck.
            </p>
          </div>
        )}
      </div>

      <MotivationBubble trigger="load" />
    </main>
  );
}
