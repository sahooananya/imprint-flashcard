'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { getAllDecks, saveDeck, deleteDeck } from '../lib/storage';
import { getMastery, getDueCards, getStreak } from '../lib/sm2';
import MotivationBubble from '../components/bubble';

const MODES = [
  { id: 'quick',    label: '⚡ Quick',    desc: '10 cards' },
  { id: 'standard', label: '📖 Standard', desc: '20 cards' },
  { id: 'deep',     label: '🧠 Deep',     desc: '35 cards' },
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

function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return DAILY_QUOTES[dayIndex % DAILY_QUOTES.length];
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
    const all   = getAllDecks();
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

  async function compressImage(file) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX) { height = (height * MAX) / width; width = MAX; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.82);
      };
      img.src = URL.createObjectURL(file);
    });
  }

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

  return (
    <main className="min-h-screen px-5 py-10 max-w-4xl mx-auto">

      {/*header */}
      <header className="flex items-start justify-between mb-12 animate-slide-up">
        <div>

          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 700,
            fontSize: 'clamp(2.4rem, 5.5vw, 4rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
          }}>
            Imprint<br />
            <em style={{ color: 'var(--accent-soft)', fontStyle: 'italic', fontWeight: 400 , fontSize: 'clamp(1.4rem, 3vw, 2rem)', display: 'block',  marginTop: 8, }}>
              Leave a mark.
            </em>
          </h1>
          <p style={{ color: 'var(--text-muted)' }} className="text-base">
            PDF, PowerPoint, or image — get smart flashcards instantly.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 ml-4 shrink-0">
          <button onClick={toggleTheme}
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 9999 }}
            className="font-mono text-xs px-3 py-1.5 transition-colors hover:opacity-80">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          {streak > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}
              className="flex flex-col items-center px-4 py-3 float">
              <span className="text-2xl">🔥</span>
              <span style={{ color: 'var(--amber)', fontFamily: 'Playfair Display' }} className="text-xl">{streak}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono' }} className="text-xs">day streak</span>
            </div>
          )}
        </div>
      </header>

      {/* due banner*/}
      {totalDue > 0 && (
        <div style={{ background: 'rgba(232,168,66,0.08)', border: '1px solid rgba(232,168,66,0.25)', borderRadius: 9999 }}
          className="flex items-center gap-2 px-4 py-2 w-fit mb-8 animate-fade-in">
          <div style={{ background: 'var(--amber)', borderRadius: '50%', width: 7, height: 7 }} className="animate-pulse-soft" />
          <span style={{ color: 'var(--amber-soft)', fontFamily: 'DM Mono' }} className="text-sm">
            {totalDue} card{totalDue !== 1 ? 's' : ''} due for review
          </span>
        </div>
      )}

      {/*motivation quote*/}
      <div style={{
        borderLeft: '2px solid var(--amber-dim)',
        paddingLeft: 16, marginBottom: 28,
        color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.6
      }}>
        "{getDailyQuote()}"
      </div>

      {/* flash card types */}
      <div className="grid grid-cols-3 gap-2 mb-4 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{
              background: mode === m.id ? 'var(--bg-card)' : 'var(--bg-raised)',
              border: `1.5px solid ${mode === m.id ? 'var(--amber-dim)' : 'var(--border)'}`,
              borderRadius: 12, color: mode === m.id ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            className="py-3 text-center transition-all duration-200 hover:opacity-90">
            <div style={{ fontFamily: 'DM Mono' }} className="text-sm font-medium">{m.label}</div>
            <div style={{ color: 'var(--text-faint)' }} className="text-xs mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* uploading_files */}
      <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--amber)' : 'var(--border-soft)'}`,
            background: dragOver ? 'rgba(232,168,66,0.06)' : 'var(--bg-raised)',
            borderRadius: 18,
            cursor: uploading ? 'default' : 'pointer',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
            transition: 'all 0.25s ease',
          }}
          className="p-12 text-center">
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
          {uploading ? (
            <div className="space-y-3">
              <div style={{ border: '2px solid var(--amber)', borderTopColor: 'transparent', borderRadius: '50%', width: 36, height: 36 }}
                className="animate-spin mx-auto" />
              <p style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono' }} className="text-sm">{uploadStatus}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-4xl">📄</p>
              <div>
                <p style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display' }} className="text-xl mb-1">
                  Drop your file here
                </p>
                <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                  PDF · PowerPoint (.pptx) · Image (JPG, PNG)
                </p>
              </div>
              {uploadStatus && (
                <p style={{ color: uploadStatus.startsWith('✓') ? 'var(--sage)' : 'var(--rose)', fontFamily: 'DM Mono' }} className="text-sm">
                  {uploadStatus}
                </p>
              )}
            </div>
          )}
        </div>

        <input type="text" value={deckName} onChange={(e) => setDeckName(e.target.value)}
          placeholder="Deck name (optional — defaults to filename)"
          style={{
            background: 'var(--bg-raised)', border: '1.5px solid var(--border)',
            borderRadius: 12, color: 'var(--text-primary)', marginTop: 12,
          }}
          className="w-full px-4 py-3 text-sm transition-colors focus:outline-none" />
      </div>

      {/* deck list */}
      {decks.length > 0 && (
          <>
          {/* mastery explanation */}
          <div style={{
            background: 'var(--bg-card)', border: '1.5px solid var(--border)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 24,
            display: 'flex', gap: 14, alignItems: 'flex-start'
          }}>
            <span style={{fontSize: 22, flexShrink: 0}}>🔁</span>
            <div>
              <p style={{color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4, fontSize: 14}}>
                Why isn't your deck 100% yet?
              </p>
              <p style={{color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0}}>
                Because remembering something once isn't the same as knowing it. Mastery means you recalled it today, again in a few days, and again a week later — that's what sticks.
              </p>
            </div>
          </div>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h2 style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display' }} className="text-2xl">Your Decks</h2>
            <div className="flex flex-wrap gap-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search…"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 9999, color: 'var(--text-primary)' }}
                className="font-mono text-xs px-4 py-2 w-36 focus:outline-none" />
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? 'var(--amber)' : 'var(--bg-raised)',
                    color: filter === f ? '#1a1612' : 'var(--text-muted)',
                    border: `1px solid ${filter === f ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 9999,
                  }}
                  className="font-mono text-xs px-3 py-2 capitalize transition-all">
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredDecks.length === 0 && (
            <p style={{ color: 'var(--text-faint)' }} className="text-center italic py-8">No decks match this filter.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDecks.map((deck, i) => {
              const mastery = getMastery(deck.cards);
              const due     = getDueCards(deck.cards).length;
              const masteryColor = mastery >= 80 ? 'var(--sage)' : mastery >= 40 ? 'var(--amber-soft)' : 'var(--rose)';
              const types = ['concept','definition','example'].map((t) => ({
                t, count: deck.cards.filter((c) => c.type === t).length
              })).filter((x) => x.count > 0);

              return (
                <div key={deck.id} onClick={() => router.push(`/deck/${deck.id}`)}
                  className="group relative card-surface p-6 cursor-pointer animate-slide-up hover-lift"
                  style={{ animationDelay: `${i * 0.04}s` }}>

                  <button onClick={(e) => handleDelete(e, deck.id)}
                    style={{ color: 'var(--text-faint)', position: 'absolute', top: 16, right: 16, fontSize: 20, lineHeight: 1 }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose transition-all">×</button>

                  <h3 style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display', lineHeight: 1.3 }}
                    className="text-xl mb-1 pr-8">{deck.title}</h3>

                  <p style={{ color: 'var(--text-faint)', fontFamily: 'DM Mono' }} className="text-xs mb-3">
                    {deck.cards.length} cards · {new Date(deck.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {deck.mode && <span className="ml-1 opacity-60">· {deck.mode}</span>}
                  </p>

                  {deck.topics?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {deck.topics.slice(0, 3).map((t) => (
                        <span key={t} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 9999 }}
                          className="font-mono text-xs px-2 py-0.5">{t}</span>
                      ))}
                      {deck.topics.length > 3 && <span style={{ color: 'var(--text-faint)' }} className="font-mono text-xs py-0.5">+{deck.topics.length - 3}</span>}
                    </div>
                  )}

                  {types.length > 0 && (
                    <div className="flex gap-3 mb-3">
                      {types.map(({ t, count }) => (
                        <span key={t} style={{ color: 'var(--text-muted)' }} className="font-mono text-xs">
                          {t === 'concept' ? '💡' : t === 'definition' ? '📖' : '🔢'} {count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={{ background: 'var(--bg)', borderRadius: 9999, height: 5 }} className="w-full mb-3">
                    <div style={{ width: `${mastery}%`, background: 'var(--amber)', borderRadius: 9999, height: 5 }} className="progress-bar" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ color: masteryColor, fontFamily: 'DM Mono' }} className="text-xs">{mastery}% mastered</span>
                    <div className="flex gap-2 items-center">
                      {due > 0 && (
                        <span style={{ color: 'var(--amber-soft)', background: 'rgba(232,168,66,0.1)', border: '1px solid rgba(232,168,66,0.2)', borderRadius: 9999 }}
                          className="font-mono text-xs px-2 py-0.5">{due} due</span>
                      )}
                      {deck.lastStudied && (
                        <span style={{ color: 'var(--text-faint)' }} className="font-mono text-xs">↩ resume</span>
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
        <p style={{ color: 'var(--text-faint)', fontFamily: 'Playfair Display' }}
          className="text-center italic text-xl mt-20">
          No decks yet. Upload a file to begin.
        </p>
      )}

      <MotivationBubble trigger="load" />
    </main>
  );
}
