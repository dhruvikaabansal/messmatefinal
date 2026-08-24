import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../lib/api';
import { friendlyDate, mealEmoji, mealLabel, timeAgo } from '../lib/format';
import { useToast } from '../lib/toast';
import { Avatar, EmptyState, RowSkeleton } from '../components/ui';

/**
 * Inbox — every conversation in one list: 1-on-1 matches and group tables,
 * current plans first, past meals below.
 */
const Inbox = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [matches, setMatches] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([api.get('/match/list'), api.get('/community')]);
      setMatches(m.data.matches || []);
      setTables(c.data.myTables || []);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <main className="page stack">
        <h1>Inbox</h1>
        <RowSkeleton />
        <RowSkeleton />
      </main>
    );
  }

  const active = matches.filter((m) => m.status === 'active');
  const past = matches.filter((m) => m.status !== 'active');
  const nothing = active.length === 0 && tables.length === 0 && past.length === 0;

  return (
    <main className="page stack">
      <h1>Inbox 💬</h1>

      {nothing && (
        <EmptyState
          emoji="🍜"
          title="No plans yet"
          body="Once you match with someone or join a table, your conversation lands here."
          action={<button className="btn btn--primary" onClick={() => navigate('/discover')}>Find someone</button>}
        />
      )}

      {(active.length > 0 || tables.length > 0) && (
        <div className="stack-sm">
          <div className="eyebrow">Happening</div>

          {active.map((m) => (
            <button
              key={m._id}
              className="card row"
              onClick={() => navigate(`/inbox/match/${m._id}`)}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <Avatar src={m.user?.profilePic} name={m.user?.name} size="md" />
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                <div className="row-between">
                  <strong>{m.user?.name}</strong>
                  {m.lastMessageAt && <span className="small muted">{timeAgo(m.lastMessageAt)}</span>}
                </div>
                <span className="small muted truncate">
                  {m.lastMessagePreview || `${mealEmoji(m.mealTime)} ${mealLabel(m.mealTime)} · ${friendlyDate(m.mealDate)}`}
                </span>
              </div>
              {m.unread > 0 && <span className="chip chip--tomato">{m.unread}</span>}
            </button>
          ))}

          {tables.map((t) => (
            <button
              key={t._id}
              className="card row"
              onClick={() => navigate(`/inbox/community/${t._id}`)}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: 'var(--plum)' }}
            >
              <div className="avatar-stack">
                {t.members?.slice(0, 3).map((mm) => (
                  <Avatar key={mm._id} src={mm.profilePic} name={mm.name} size="sm" />
                ))}
              </div>
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                <div className="row-between">
                  <strong>{t.name}</strong>
                  {t.lastMessageAt && <span className="small muted">{timeAgo(t.lastMessageAt)}</span>}
                </div>
                <span className="small muted truncate">
                  {t.lastMessagePreview || `${t.members?.length} at the table · ${mealLabel(t.mealTime)}`}
                </span>
              </div>
              <span className="chip chip--plum">👥</span>
            </button>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="stack-sm">
          <div className="eyebrow">Past meals</div>
          {past.map((m) => (
            <div key={m._id} className="card row" style={{ opacity: 0.75, boxShadow: 'none' }}>
              <Avatar src={m.user?.profilePic} name={m.user?.name} size="sm" />
              <div className="grow stack-sm" style={{ gap: 0 }}>
                <strong className="small">{m.user?.name}</strong>
                <span className="small muted">
                  {mealLabel(m.mealTime)} · {friendlyDate(m.mealDate)}
                </span>
              </div>
              <span className="chip chip--soft">
                {m.status === 'completed' ? '✅ Done' : m.status === 'expired' ? '⏰ Expired' : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default Inbox;
