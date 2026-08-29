import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSession } from '../store/SessionContext';
import { Window } from '../components/ui';

const STEPS = [
  { n: '1', emoji: '🍱', tone: 'sky', title: 'Pick your meal', body: 'Breakfast, lunch, snacks or dinner — today or tomorrow.' },
  { n: '2', emoji: '👀', tone: 'chrome', title: 'See who else is free', body: 'Only people from your campus, ranked by how well you actually fit.' },
  { n: '3', emoji: '🤝', tone: 'pink', title: 'Invite or take a seat', body: 'Match 1-on-1, or join an open table. Then just show up.' },
];

const TICKER = [
  '🍜 someone is eating in 20 mins',
  '🧋 3 open tables today',
  '🍳 breakfast closes at 10',
  '🥟 snack o clock',
  '🍛 dinner till 10pm',
  '☕ chai break?',
];

/** Emoji scattered behind the hero. Decoration only, hidden from screen readers. */
const CONFETTI = [
  { e: '🍜', top: '6%', left: '4%', delay: '0s' },
  { e: '🧋', top: '14%', right: '6%', delay: '0.7s' },
  { e: '🍩', top: '46%', left: '2%', delay: '1.4s' },
  { e: '🍕', top: '38%', right: '3%', delay: '2.1s' },
  { e: '⭐', top: '68%', left: '7%', delay: '0.3s' },
  { e: '🍙', top: '74%', right: '8%', delay: '1.8s' },
];

const Landing = () => {
  const { isAuthed, isReady } = useSession();
  if (isReady && isAuthed) return <Navigate to="/discover" replace />;

  return (
    <div style={{ position: 'relative', overflowX: 'hidden' }}>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="float-sticker"
          aria-hidden
          style={{ top: c.top, left: c.left, right: c.right, animationDelay: c.delay }}
        >
          {c.e}
        </span>
      ))}

      <div className="page page--wide stack" style={{ paddingBottom: 40, gap: 32 }}>
        <header className="row-between" style={{ paddingTop: 8 }}>
          <span className="brand">MessMate 🍽️</span>
          <div className="row" style={{ gap: 8 }}>
            <Link to="/login" className="btn btn--sm">Log in</Link>
            <Link to="/register" className="btn btn--primary btn--sm">Sign up</Link>
          </div>
        </header>

        {/* ── Hero, framed as a window ── */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <Window title="messmate.exe" tone="pink">
            <div className="stack" style={{ textAlign: 'center', alignItems: 'center', gap: 18 }}>
              <span className="chip chip--sky sticker">🎓 your campus only</span>

              <h1 style={{ fontSize: 'clamp(2.1rem, 7.5vw, 3.4rem)', maxWidth: 620 }}>
                Nobody should eat<br />
                <span className="holo">lunch alone.</span>
              </h1>

              <p className="muted" style={{ maxWidth: 500, fontSize: '1.02rem' }}>
                Say when you're eating. MessMate finds someone from your college who's free
                at the same time — or an open table you can just sit down at.
              </p>

              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <Link to="/register" className="btn btn--primary">Find someone for today →</Link>
                <Link to="/login" className="btn btn--sky">I already have an account</Link>
              </div>

              <div className="chip-group" style={{ justifyContent: 'center' }}>
                <span className="chip chip--sky sticker">🍳 breakfast</span>
                <span className="chip chip--tomato sticker--r">🍱 lunch</span>
                <span className="chip chip--sky sticker">🥟 snacks</span>
                <span className="chip chip--tomato sticker--r">🍛 dinner</span>
              </div>
            </div>
          </Window>
        </motion.div>
      </div>

      {/* ── Ticker, full bleed ── */}
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <div className="page page--wide stack" style={{ paddingTop: 32, gap: 28 }}>
        <h2 className="center">How it works</h2>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          }}
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <Window title={`step ${s.n}`} tone={s.tone}>
                <div className="stack-sm">
                  <span style={{ fontSize: '2rem', lineHeight: 1 }} aria-hidden>{s.emoji}</span>
                  <h3>{s.title}</h3>
                  <p className="muted small">{s.body}</p>
                </div>
              </Window>
            </motion.div>
          ))}
        </div>

        <Window title="the whole idea ♡" tone="chrome">
          <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2>Every meal is a fresh start</h2>
            <p className="muted" style={{ maxWidth: 440 }}>
              Matches last one meal. Nothing carries over, nothing lingers, and everyone
              is back in the deck for the next slot.
            </p>
            <Link to="/register" className="btn btn--primary">Get started — it's free 🎉</Link>
          </div>
        </Window>

        <footer className="center small muted">
          © {new Date().getFullYear()} MessMate · made for people who hate eating alone
        </footer>
      </div>
    </div>
  );
};

export default Landing;
