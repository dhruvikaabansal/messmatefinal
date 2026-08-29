import React, { useEffect, useState } from 'react';
import { initialsAvatar, profilePic } from '../lib/format';

/**
 * An <img> that degrades to a locally drawn initials avatar instead of the
 * browser's broken-image icon. Uploaded photos can 404 (deleted from the CDN,
 * an old local-disk path after a redeploy) and a card full of broken icons
 * reads as "this app is broken".
 */
export const SmartImg = ({ src, name, alt, className, style }) => {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? initialsAvatar(name) : profilePic(src, name);
  return (
    <img
      className={className}
      style={style}
      src={resolved}
      alt={alt ?? name ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export const Avatar = ({ src, name, size = 'md', online = false }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <SmartImg className={`avatar avatar--${size}`} src={src} name={name} alt={name || 'Profile'} />
    {online && (
      <span
        className="presence"
        title="Active now"
        style={{ position: 'absolute', right: 1, bottom: 1 }}
      />
    )}
  </div>
);

/**
 * A card dressed as an old desktop window — title bar, three little buttons.
 * `tone` picks the title-bar colour so a screen can vary without new CSS.
 */
export const Window = ({ title, tone = 'sky', flush = false, children, style, className = '' }) => (
  <section className={`win ${className}`} style={style}>
    <div className={`win-bar win-bar--${tone}`}>
      <span>{title}</span>
      <span className="win-dots" aria-hidden>
        <i className="win-dot" />
        <i className="win-dot" />
        <i className="win-dot" />
      </span>
    </div>
    <div className={`win-body ${flush ? 'win-body--flush' : ''}`}>{children}</div>
  </section>
);

export const Skeleton = ({ h = 16, w = '100%', r = 8, style }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
);

export const CardSkeleton = () => (
  <div className="card stack">
    <Skeleton h={200} r={12} />
    <Skeleton h={22} w="55%" />
    <Skeleton h={14} w="80%" />
    <div className="row">
      <Skeleton h={26} w={72} r={999} />
      <Skeleton h={26} w={92} r={999} />
      <Skeleton h={26} w={60} r={999} />
    </div>
  </div>
);

export const RowSkeleton = () => (
  <div className="card row">
    <Skeleton h={56} w={56} r={999} />
    <div className="grow stack-sm">
      <Skeleton h={16} w="50%" />
      <Skeleton h={12} w="75%" />
    </div>
  </div>
);

export const EmptyState = ({ emoji = '🍽️', title, body, action }) => (
  <div className="card empty">
    <div className="empty-emoji">{emoji}</div>
    <h2>{title}</h2>
    {body && <p className="muted">{body}</p>}
    {action}
  </div>
);

export const Sheet = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Reasons = ({ items }) =>
  !items?.length ? null : (
    <ul className="stack-sm" style={{ listStyle: 'none', padding: 0 }}>
      {items.map((r, i) => (
        <li key={i} className="row" style={{ gap: 8, fontSize: '0.88rem', fontWeight: 600 }}>
          <span aria-hidden style={{ fontSize: '1rem' }}>{r.icon}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );

/** A compact 0-100 compatibility read-out. */
export const ScorePill = ({ score }) => {
  const tone = score >= 70 ? 'chip--basil' : score >= 45 ? 'chip--saffron' : 'chip--soft';
  return (
    <span className={`chip ${tone}`} title="How well your profiles line up">
      {Math.round(score)}% match
    </span>
  );
};
