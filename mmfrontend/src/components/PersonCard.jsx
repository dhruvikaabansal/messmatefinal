import React from 'react';
import { motion } from 'framer-motion';
import { titleCase } from '../lib/format';
import { Reasons, ScorePill, SmartImg } from './ui';

/**
 * One person in the deck.
 *
 * Deliberately shows *why* this person surfaced. A swipe deck with no
 * explanation feels like a slot machine; two lines of "you're both into filter
 * coffee and badminton" turns the same list into a recommendation.
 */
const PersonCard = ({ person, onLike, onSkip, onUndo, canUndo, busy }) => (
  <motion.article
    key={person._id}
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, x: busy === 'like' ? 120 : -120, rotate: busy === 'like' ? 4 : -4 }}
    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    className="stack"
  >
    <div className="card card--pad-0">
      <div style={{ position: 'relative', aspectRatio: '4 / 5', background: 'var(--surface-2)' }}>
        <SmartImg
          src={person.profilePic}
          name={person.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {person.likedMe && (
          <span
            className="chip chip--tomato"
            style={{ position: 'absolute', top: 12, left: 12, boxShadow: 'var(--shadow)' }}
          >
            💘 Likes you
          </span>
        )}
        {person.isActiveNow && (
          <span
            className="chip chip--basil"
            style={{ position: 'absolute', top: 12, right: 12, boxShadow: 'var(--shadow)' }}
          >
            Active now
          </span>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            padding: '48px 16px 14px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.82))',
            color: '#fff',
          }}
        >
          <h1 style={{ color: '#fff', fontSize: '1.7rem' }}>
            {person.name}
            {person.age ? `, ${person.age}` : ''}
          </h1>
          <p className="small" style={{ opacity: 0.9, textTransform: 'capitalize' }}>
            {person.college}
          </p>
        </div>
      </div>
    </div>

    {person.reasons?.length > 0 && (
      <div className="card card--tint stack-sm">
        <div className="row-between">
          <span className="eyebrow">Why you two</span>
          <ScorePill score={person.matchScore} />
        </div>
        <Reasons items={person.reasons} />
      </div>
    )}

    {person.bio && (
      <div className="card">
        <p style={{ fontSize: '1.02rem' }}>{person.bio}</p>
      </div>
    )}

    {person.prompts?.[0] && (
      <div className="card card--tint">
        <div className="eyebrow">{person.prompts[0].question}</div>
        <h2 style={{ marginTop: 6 }}>{person.prompts[0].answer}</h2>
      </div>
    )}

    {person.interests?.length > 0 && (
      <div className="card stack-sm">
        <span className="eyebrow">Into</span>
        <div className="chip-group">
          {person.interests.map((i) => (
            <span key={i} className={`chip ${person.sharedInterests?.includes(i) ? 'chip--saffron' : 'chip--soft'}`}>
              {i}
            </span>
          ))}
        </div>
      </div>
    )}

    {(person.intent || person.foodPreference || person.personalityType) && (
      <div className="chip-group">
        {person.intent && <span className="chip chip--soft">🎯 {titleCase(person.intent)}</span>}
        {person.foodPreference && <span className="chip chip--soft">🥗 {titleCase(person.foodPreference)}</span>}
        {person.personalityType && <span className="chip chip--soft">🧠 {titleCase(person.personalityType)}</span>}
      </div>
    )}

    {person.prompts?.[1] && (
      <div className="card card--tint">
        <div className="eyebrow">{person.prompts[1].question}</div>
        <h2 style={{ marginTop: 6 }}>{person.prompts[1].answer}</h2>
      </div>
    )}

    {person.outsideYourFilter && (
      <div className="banner banner--info">
        Outside your gender filter — shown because your campus is quiet right now.
      </div>
    )}

    <div className="row" style={{ gap: 12, marginTop: 4 }}>
      {canUndo && (
        <button className="btn btn--ghost" onClick={onUndo} disabled={Boolean(busy)} aria-label="Undo last pass">
          ↩︎
        </button>
      )}
      <button className="btn grow" onClick={onSkip} disabled={Boolean(busy)}>
        Pass
      </button>
      <button className="btn btn--primary grow" onClick={onLike} disabled={Boolean(busy)}>
        {person.likedMe ? '⚡ Match now' : '💛 Invite'}
      </button>
    </div>
  </motion.article>
);

export default PersonCard;
