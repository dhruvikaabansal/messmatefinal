import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api, { errorCode, errorMessage } from '../lib/api';
import { friendlyDate, mealLabel } from '../lib/format';
import { useToast } from '../lib/toast';
import { useSession } from '../store/SessionContext';
import SlotSwitcher from '../components/SlotSwitcher';
import PersonCard from '../components/PersonCard';
import TableCard from '../components/TableCard';
import CreateTable from '../components/CreateTable';
import { Avatar, CardSkeleton, EmptyState } from '../components/ui';

/**
 * Discover — the whole app in one screen.
 *
 * Renders entirely from GET /api/slot/status. Whatever the server says the
 * user's state is, that's what shows: a deck, a locked match, or a table. No
 * page can disagree with another because there is only one source.
 */
const Discover = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { profileComplete, isReady, refresh } = useSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(null);
  const [skipped, setSkipped] = useState(0);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.get('/slot/status');
      setData(res.data);
      setIndex(0);
    } catch (err) {
      if (errorCode(err) !== 'PROFILE_INCOMPLETE') toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isReady && !profileComplete) navigate('/onboarding', { replace: true });
  }, [isReady, profileComplete, navigate]);

  useEffect(() => {
    if (profileComplete) load();
  }, [profileComplete, load]);

  const feed = data?.feed || [];
  const current = feed[index];

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setBusy(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const like = async (person) => {
    setBusy('like');
    try {
      const res = await api.post('/match/like', { targetUserId: person._id });
      if (res.data.isMatch) {
        toast.success(`It's a match with ${person.name}! 🎉`);
        await load({ quiet: true });
        setBusy(null);
        return;
      }
      toast.toast(`Invite sent to ${person.name}`);
      advance();
    } catch (err) {
      const msg = errorMessage(err);
      toast.error(msg);
      // "Taken" and "slot closed" both mean the deck we're holding is stale.
      if (err.response?.data?.taken) advance();
      else if (err.response?.status === 409) await load({ quiet: true });
      else setBusy(null);
    }
  };

  const skip = async (person) => {
    setBusy('skip');
    try {
      await api.post('/match/skip', { targetUserId: person._id });
      setSkipped((n) => n + 1);
      advance();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  };

  const undo = async () => {
    try {
      await api.post('/match/undo');
      setSkipped((n) => Math.max(0, n - 1));
      toast.toast('Brought them back');
      await load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const joinTable = async (table) => {
    setBusy('join');
    try {
      await api.post('/community/join', { communityId: table._id });
      toast.success(`You're in — ${table.name}`);
      await load({ quiet: true });
      setBusy(null);
    } catch (err) {
      toast.error(errorMessage(err));
      await load({ quiet: true });
      setBusy(null);
    }
  };

  const leaveMatch = async (action) => {
    const isUnmatch = action === 'unmatch';
    const ok = await toast.confirm({
      title: isUnmatch ? 'Unmatch?' : 'Mark this meal done?',
      body: isUnmatch
        ? 'You will both go back into the deck for this slot, and the chat is deleted.'
        : 'This closes the match and saves it to your history.',
      confirmLabel: isUnmatch ? 'Unmatch' : 'Meal done',
      tone: isUnmatch ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      await api.post(`/match/${isUnmatch ? 'unmatch' : 'complete'}`, { matchId: data.matchData._id });
      await load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const leaveTable = async () => {
    const ok = await toast.confirm({
      title: 'Leave this table?',
      body: 'Your seat opens up for someone else.',
      confirmLabel: 'Leave',
    });
    if (!ok) return;
    try {
      await api.post('/community/leave', { communityId: data.communityData._id });
      await load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const header = useMemo(
    () => <SlotSwitcher slot={data} slots={data?.slots} onChanged={() => load({ quiet: true })} />,
    [data, load]
  );

  if (loading) {
    return (
      <main className="page stack">
        <div className="skeleton" style={{ height: 62, borderRadius: 16 }} />
        <CardSkeleton />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <EmptyState
          emoji="📡"
          title="Couldn't reach MessMate"
          body="Check your connection and try again."
          action={<button className="btn btn--primary" onClick={() => load()}>Retry</button>}
        />
      </main>
    );
  }

  // ── Locked into a match ───────────────────────────────────────────────────
  if (data.state === 'matched' && data.matchData) {
    const partner = data.matchData.user;
    return (
      <main className="page stack">
        {header}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card stack">
          <span className="chip chip--basil" style={{ alignSelf: 'flex-start' }}>🎉 Matched</span>
          <div className="row">
            <Avatar src={partner?.profilePic} name={partner?.name} size="lg" />
            <div className="grow stack-sm" style={{ gap: 2 }}>
              <h2>{partner?.name}{partner?.age ? `, ${partner.age}` : ''}</h2>
              <p className="small muted capitalize">{partner?.college}</p>
              <p className="small">
                {mealLabel(data.matchData.mealTime)} · {friendlyDate(data.matchData.mealDate)}
              </p>
            </div>
          </div>
          {partner?.bio && <p className="muted">{partner.bio}</p>}
          <button
            className="btn btn--primary btn--block"
            onClick={() => navigate(`/inbox/match/${data.matchData._id}`)}
          >
            💬 Message {partner?.name?.split(' ')[0]}
            {data.unread > 0 && <span className="chip chip--tomato">{data.unread}</span>}
          </button>
          <div className="row">
            <button className="btn btn--ghost grow" onClick={() => leaveMatch('complete')}>✅ Meal done</button>
            <button className="btn btn--ghost grow" onClick={() => leaveMatch('unmatch')}>Unmatch</button>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── Seated at a table ─────────────────────────────────────────────────────
  if (data.state === 'in_community' && data.communityData) {
    const t = data.communityData;
    return (
      <main className="page stack">
        {header}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card stack">
          <span className="chip chip--plum" style={{ alignSelf: 'flex-start' }}>👥 Your table</span>
          <h2>{t.name}</h2>
          {t.description && <p className="muted">{t.description}</p>}
          {t.venue && <p className="small">📍 {t.venue}</p>}
          <div className="row wrap">
            {t.members?.map((m) => (
              <div key={m._id} className="row" style={{ gap: 6 }}>
                <Avatar src={m.profilePic} name={m.name} size="sm" />
                <span className="small">{m.name?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <p className="small muted">
            {t.seatsLeft > 0 ? `${t.seatsLeft} seat${t.seatsLeft === 1 ? '' : 's'} still open` : 'Table is full'}
          </p>
          <button className="btn btn--primary btn--block" onClick={() => navigate(`/inbox/community/${t._id}`)}>
            💬 Open table chat
            {data.unread > 0 && <span className="chip chip--tomato">{data.unread}</span>}
          </button>
          <button className="btn btn--ghost btn--block" onClick={leaveTable}>Leave table</button>
        </motion.div>
      </main>
    );
  }

  // ── Slot closed ───────────────────────────────────────────────────────────
  if (data.slotStatus === 'closed') {
    return (
      <main className="page stack">
        {header}
        <EmptyState
          emoji="⏰"
          title="That meal has passed"
          body="Pick the next slot and you're back in."
          action={<p className="small muted">Tap the bar above to switch.</p>}
        />
      </main>
    );
  }

  // ── The deck ──────────────────────────────────────────────────────────────
  return (
    <main className="page stack">
      {header}

      {data.expandedSearch && (
        <div className="banner banner--warn">
          Not many people in this slot yet — we widened your gender filter to fill the deck.
        </div>
      )}

      <AnimatePresence mode="wait">
        {!current ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState
              emoji={feed.length ? '✅' : '🌱'}
              title={feed.length ? "That's everyone for this slot" : 'Nobody here yet'}
              body={
                feed.length
                  ? 'Start a table so people can come to you, or try the next meal.'
                  : `Be the first for ${mealLabel(data.mealTime).toLowerCase()}. Open a table and people joining this slot will see it.`
              }
              action={
                <div className="stack" style={{ width: '100%' }}>
                  <button className="btn btn--primary btn--block" onClick={() => setCreating(true)}>
                    👥 Start a table
                  </button>
                  {skipped > 0 && (
                    <button className="btn btn--ghost btn--block" onClick={undo}>
                      ↩︎ Undo my last pass
                    </button>
                  )}
                </div>
              }
            />
          </motion.div>
        ) : current.kind === 'table' ? (
          <TableCard key={current._id} table={current} busy={busy} onJoin={() => joinTable(current)} />
        ) : (
          <PersonCard
            key={current._id}
            person={current}
            busy={busy}
            canUndo={skipped > 0}
            onUndo={undo}
            onLike={() => like(current)}
            onSkip={() => skip(current)}
          />
        )}
      </AnimatePresence>

      {current && (
        <div className="row-between small muted">
          <span>{index + 1} of {feed.length}</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setCreating(true)}>
            👥 Start a table
          </button>
        </div>
      )}

      <CreateTable
        open={creating}
        slot={data}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          setCreating(false);
          await load({ quiet: true });
          refresh();
        }}
      />
    </main>
  );
};

export default Discover;
