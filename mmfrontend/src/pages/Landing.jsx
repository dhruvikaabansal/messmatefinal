import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSession } from '../store/SessionContext';

const STEPS = [
  { n: '1', title: 'Pick your meal', body: 'Breakfast, lunch, snacks or dinner — today or tomorrow.' },
  { n: '2', title: 'See who else is free', body: 'Only people from your campus, ranked by how well you actually fit.' },
  { n: '3', title: 'Invite or take a seat', body: 'Match 1-on-1, or join an open table. Then just show up.' },
];

const Landing = () => {
  const { isAuthed, isReady } = useSession();
  if (isReady && isAuthed) return <Navigate to="/discover" replace />;

  return (
    <div className="page page--wide stack" style={{ paddingBottom: 48, gap: 40 }}>
      <header className="row-between" style={{ paddingTop: 8 }}>
        <span className="brand">MessMate 🍽️</span>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/login" className="btn btn--ghost btn--sm">Log in</Link>
          <Link to="/register" className="btn btn--primary btn--sm">Sign up</Link>
        </div>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="stack"
        style={{ textAlign: 'center', alignItems: 'center', gap: 20 }}
      >
        <span className="chip chip--saffron">🎓 Your campus only</span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 8vw, 3.6rem)', maxWidth: 620 }}>
          Nobody should eat<br />
          <span style={{ color: 'var(--tomato)' }}>lunch alone.</span>
        </h1>
        <p className="muted" style={{ maxWidth: 520, fontSize: '1.05rem' }}>
          Say when you're eating. MessMate finds someone from your college who's free
          at the same time — or an open table you can just sit down at.
        </p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Link to="/register" className="btn btn--primary">Find someone for today →</Link>
          <Link to="/login" className="btn btn--ghost">I already have an account</Link>
        </div>
        <div className="chip-group" style={{ justifyContent: 'center' }}>
          <span className="chip chip--soft">Same campus</span>
          <span className="chip chip--soft">One plan per meal</span>
          <span className="chip chip--soft">Solo or group</span>
          <span className="chip chip--soft">Free</span>
        </div>
      </motion.section>

      <section className="stack">
        <h2 className="center">How it works</h2>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="card stack-sm"
            >
              <span
                className="chip chip--tomato"
                style={{ width: 34, height: 34, justifyContent: 'center', padding: 0, borderRadius: '50%' }}
              >
                {s.n}
              </span>
              <h3>{s.title}</h3>
              <p className="muted small">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="card card--tint stack" style={{ textAlign: 'center', alignItems: 'center' }}>
        <h2>Every meal is a fresh start</h2>
        <p className="muted" style={{ maxWidth: 460 }}>
          Matches last one meal. Nothing carries over, nothing lingers, and everyone
          is back in the deck for the next slot.
        </p>
        <Link to="/register" className="btn btn--primary">Get started — it's free</Link>
      </section>

      <footer className="center small muted">© {new Date().getFullYear()} MessMate</footer>
    </div>
  );
};

export default Landing;
