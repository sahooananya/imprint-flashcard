'use client';

import { useState, useEffect } from 'react';

const QUOTES = [
    "Consistency beats intensity.",
    "You're closer than you think.",
    "This is how memory builds.",
    "Hard cards = growth.",
    "Small sessions compound.",
    "Struggle is the curriculum.",
    "One more card.",
    "Your future self is watching.",
    "Recall is the real learning.",
    "Show up. That's the whole trick.",
];

export default function MotivationBubble({ trigger = 'load' }) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [quote, setQuote] = useState('');

    const dismiss = () => {
        setExiting(true);
        setTimeout(() => { setVisible(false); setExiting(false); }, 400);
    };

    const show = () => {
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        setQuote(q);
        setVisible(true);
        setTimeout(() => dismiss(), 5000);
    };

    useEffect(() => {
        if (trigger !== 'load') return;
        const seen = sessionStorage.getItem('bubble_shown');
        if (seen) return;
        const t = setTimeout(() => {
            show();
            sessionStorage.setItem('bubble_shown', 'true');
        }, 1200);
        return () => clearTimeout(t);
    }, []);

    // expose show() for external trigger (e.g. after session done)
    useEffect(() => {
        if (trigger === 'external') return;
    }, [trigger]);

    if (!visible) return null;

    return (
        <div
            onClick={dismiss}
            style={{
                position: 'fixed',
                bottom: 28,
                right: 28,
                zIndex: 9999,
                maxWidth: 280,
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)',
                borderRadius: 16,
                padding: '14px 18px',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer',
                animation: exiting
                    ? 'bubbleOut 0.4s ease forwards'
                    : 'bubbleIn 0.35s ease forwards',
                backdropFilter: 'blur(8px)',
            }}
        >
            <p style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '0.9rem',
                lineHeight: 1.55,
                color: 'var(--text-primary)',
                margin: 0,
            }}>
                "{quote}"
            </p>
            <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginTop: 8,
                marginBottom: 0,
            }}>
                tap to dismiss
            </p>

            <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bubbleOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(8px); }
        }
      `}</style>
        </div>
    );
}