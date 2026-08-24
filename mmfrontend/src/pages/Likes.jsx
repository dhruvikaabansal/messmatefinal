import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { errorMessage } from '../lib/api';
import { friendlyDate, mealLabel, timeAgo } from '../lib/format';
import { useToast } from '../lib/toast';
import { Avatar, EmptyState, Reasons, RowSkeleton, ScorePill } from '../components/ui';

/**
 * People who invited you for this slot. Accepting is an instant match, so this
 * screen is the fastest path to an actual meal — which is why it gets its own
 * tab instead of being buried inside Discover.
 */
const Likes = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/slot/status');
      setData(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const accept = async (person) => {
    setBusyId(person._id);
    try {
      const res = await api.post('/match/like', { targetUserId: person._id });
      if (res.data.isMatch) {
        toast.success(`Matched with ${person.name}! 🎉`);
        navigate(`/inbox/match/${res.data.matchId}`);
        return;
      }
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (person) => {
    setBusyId(person._id);
    try {
      await api.post('/match/ignore', { likeId: person.likeId });
      setData((d) => ({ ...d, likesReceived: d.likesReceived.filter((l) => l._id !== person._id) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <main className="page stack">
        <h1>Invites</h1>
        <RowSkeleton />
        <RowSkeleton />
      </main>
    );
  }

  const locked = data?.state === 'matched' || data?.state === 'in_community';
  const likes = data?.likesReceived || [];

  return (
    <main className="page stack">
      <div className="stack-sm">
        <h1>Invites 💛</h1>
        <p className="small muted">
          {mealLabel(data?.mealTime)} · {friendlyDate(data?.mealDate)}
        </p>
      </div>

      {locked ? (
        <EmptyState
          emoji={data.state === 'matched' ? '🔒' : '👥'}
          title={data.state === 'matched' ? "You're already matched" : "You're at a table"}
          body="Invites are paused while you have plans for this slot."
          action={
            <button className="btn btn--primary" onClick={() => navigate('/discover')}>
              See my plan
            </button>
          }
        />
      ) : likes.length === 0 ? (
        <EmptyState
          emoji="🌾"
          title="No invites yet"
          body="Invites you send are far more likely to come back. Keep going in Discover."
          action={<button className="btn btn--primary" onClick={() => navigate('/discover')}>Go to Discover</button>}
        />
      ) : (
        <AnimatePresence>
          {likes.map((p) => (
            <motion.div
              key={p._id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="card stack"
            >
              <div className="row">
                <Avatar src={p.profilePic} name={p.name} size="lg" />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <h2 style={{ fontSize: '1.2rem' }}>
                    {p.name}{p.age ? `, ${p.age}` : ''}
                  </h2>
                  <p className="small muted capitalize">{p.college}</p>
                  <span className="small muted">invited you {timeAgo(p.likedAt)}</span>
                </div>
                <ScorePill score={p.matchScore} />
              </div>

              {p.bio && <p className="muted">{p.bio}</p>}
              {p.reasons?.length > 0 && (
                <div className="card card--tint card--flat">
                  <Reasons items={p.reasons} />
                </div>
              )}
              {p.interests?.length > 0 && (
                <div className="chip-group">
                  {p.interests.slice(0, 6).map((i) => (
                    <span key={i} className={`chip ${p.sharedInterests?.includes(i) ? 'chip--saffron' : 'chip--soft'}`}>
                      {i}
                    </span>
                  ))}
                </div>
              )}

              <div className="row">
                <button className="btn btn--ghost grow" disabled={busyId === p._id} onClick={() => dismiss(p)}>
                  Not now
                </button>
                <button className="btn btn--primary grow" disabled={busyId === p._id} onClick={() => accept(p)}>
                  ⚡ Match
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </main>
  );
};

export default Likes;
