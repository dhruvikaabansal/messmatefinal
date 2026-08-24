import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../lib/api';
import { clockTime } from '../lib/format';
import { useToast } from '../lib/toast';
import { useSession } from '../store/SessionContext';
import { Skeleton } from '../components/ui';

/**
 * A conversation — works identically for a 1-on-1 match and a group table.
 *
 * Delivery is short-poll: 4s while the tab is visible, paused when it isn't.
 * That is fast enough for "I'm at the second table on the left" and needs no
 * websocket server, which keeps the app deployable anywhere.
 */
const POLL_MS = 4000;

const QUICK = ['On my way 🏃', 'Give me 10 mins', 'Where are you sitting?', 'Running late, sorry!'];

const Thread = () => {
  const { threadType, threadId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setUnread } = useSession();

  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const lastAt = useRef(null);
  const bottom = useRef(null);
  const scroller = useRef(null);

  const scrollToEnd = (smooth = true) =>
    bottom.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });

  const fetchMessages = useCallback(
    async ({ initial = false } = {}) => {
      try {
        const res = await api.get(`/chat/${threadType}/${threadId}`, {
          params: initial ? {} : { after: lastAt.current },
        });
        setTitle(res.data.title || '');
        const incoming = res.data.messages || [];
        if (incoming.length) {
          lastAt.current = incoming[incoming.length - 1].createdAt;
          setMessages((prev) => {
            if (initial) return incoming;
            const seen = new Set(prev.map((m) => m._id));
            return [...prev, ...incoming.filter((m) => !seen.has(m._id))];
          });
        } else if (initial) {
          setMessages([]);
          lastAt.current = res.data.serverTime;
        }
        // Opening the thread marks it read server-side; keep the badge honest.
        setUnread((u) => (initial ? Math.max(0, u - (res.data.messages?.length || 0)) : u));
      } catch (err) {
        if (err.response?.status === 403) {
          toast.error('This conversation is no longer available.');
          navigate('/inbox', { replace: true });
          return;
        }
        if (initial) toast.error(errorMessage(err));
      } finally {
        if (initial) setLoading(false);
      }
    },
    [threadType, threadId, navigate, toast, setUnread]
  );

  useEffect(() => {
    setLoading(true);
    lastAt.current = null;
    fetchMessages({ initial: true }).then(() => setTimeout(() => scrollToEnd(false), 40));
  }, [fetchMessages]);

  useEffect(() => {
    const tick = () => !document.hidden && fetchMessages();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchMessages]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom) scrollToEnd();
  }, [messages]);

  const send = async (body) => {
    const value = (body ?? text).trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await api.post(`/chat/${threadType}/${threadId}`, { text: value });
      setMessages((prev) => [...prev, res.data.message]);
      lastAt.current = res.data.message.createdAt;
      setTimeout(scrollToEnd, 30);
    } catch (err) {
      toast.error(errorMessage(err));
      setText(value);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <header className="topbar">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/inbox')} aria-label="Back">
          ←
        </button>
        <strong className="truncate" style={{ fontFamily: 'var(--font-display)' }}>
          {title || (threadType === 'community' ? 'Table' : 'Chat')}
        </strong>
        <span style={{ width: 40 }} />
      </header>

      <div
        ref={scroller}
        className="grow"
        style={{
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 'var(--maxw)',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {loading ? (
          <>
            <Skeleton h={40} w="60%" r={16} />
            <Skeleton h={40} w="45%" r={16} style={{ alignSelf: 'flex-end' }} />
            <Skeleton h={40} w="70%" r={16} />
          </>
        ) : messages.length === 0 ? (
          <p className="muted center" style={{ marginTop: 40 }}>
            Say hello and agree on a time and place.
          </p>
        ) : (
          messages.map((m) =>
            m.kind === 'system' ? (
              <div key={m._id} className="center small muted" style={{ padding: '6px 0' }}>
                {m.text}
              </div>
            ) : (
              <div
                key={m._id}
                style={{
                  alignSelf: m.mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  background: m.mine ? 'var(--tomato)' : 'var(--surface)',
                  color: m.mine ? '#fff' : 'var(--text)',
                  border: 'var(--border)',
                  borderRadius: m.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '8px 12px',
                  boxShadow: '3px 3px 0 var(--line)',
                }}
              >
                {threadType === 'community' && !m.mine && (
                  <div className="small" style={{ fontWeight: 800, opacity: 0.75 }}>
                    {m.sender?.name?.split(' ')[0]}
                  </div>
                )}
                <div style={{ wordBreak: 'break-word' }}>{m.text}</div>
                <div className="small" style={{ opacity: 0.65, textAlign: 'right', marginTop: 2 }}>
                  {clockTime(m.createdAt)}
                </div>
              </div>
            )
          )
        )}
        <div ref={bottom} />
      </div>

      <div
        style={{
          borderTop: '2.5px solid var(--line)',
          background: 'var(--surface)',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ maxWidth: 'var(--maxw)', margin: '0 auto' }} className="stack-sm">
          {messages.length <= 2 && (
            <div className="chip-group">
              {QUICK.map((q) => (
                <button key={q} className="chip chip-toggle" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="input grow"
              placeholder="Message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              aria-label="Message"
            />
            <button className="btn btn--primary" type="submit" disabled={!text.trim() || sending}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Thread;
