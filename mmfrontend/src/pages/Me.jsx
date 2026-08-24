import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../lib/api';
import { titleCase } from '../lib/format';
import { useToast } from '../lib/toast';
import { useSession } from '../store/SessionContext';
import { RowSkeleton, SmartImg } from '../components/ui';

/**
 * Me — profile preview, matching preferences and account, on one screen.
 *
 * Preferences that used to require a separate page with its own save button now
 * apply the moment you tap them. Everything here is one round-trip, so there is
 * no "did that save?" ambiguity.
 */
const Me = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, refresh } = useSession();

  const [profile, setProfile] = useState(null);
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, pr] = await Promise.all([api.get('/user/profile'), api.get('/preferences')]);
      setProfile(p.data.profile);
      setPref(pr.data.preference);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const savePref = async (patch) => {
    const previous = pref;
    setPref((p) => ({ ...p, ...patch })); // optimistic — this must feel instant
    try {
      const { data } = await api.put('/preferences', patch);
      setPref(data.preference);
    } catch (err) {
      setPref(previous);
      toast.error(errorMessage(err));
    }
  };

  const toggleAvailable = async () => {
    await savePref({ isAvailable: !pref?.isAvailable });
    await refresh();
  };

  const logout = async () => {
    const ok = await toast.confirm({
      title: 'Sign out?',
      body: 'You can sign back in any time.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    signOut();
    navigate('/', { replace: true });
  };

  if (loading || !profile) {
    return (
      <main className="page stack">
        <h1>Me</h1>
        <RowSkeleton />
        <RowSkeleton />
      </main>
    );
  }

  return (
    <main className="page stack">
      <h1>Me 👤</h1>

      {profile.missing?.length > 0 && (
        <div className="banner banner--warn">
          Add your {profile.missing.join(', ')} — incomplete profiles get far fewer invites.
        </div>
      )}

      {/* ── Profile preview: exactly what others see ── */}
      <div className="card card--pad-0">
        <div style={{ position: 'relative', aspectRatio: '4 / 5', background: 'var(--surface-2)' }}>
          <SmartImg
            src={profile.profilePic}
            name={profile.name}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <span className="chip chip--saffron" style={{ position: 'absolute', top: 12, left: 12 }}>
            Preview
          </span>
          <div
            style={{
              position: 'absolute',
              inset: 'auto 0 0 0',
              padding: '48px 16px 14px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.82))',
              color: '#fff',
            }}
          >
            <h2 style={{ color: '#fff' }}>
              {profile.name}{profile.age ? `, ${profile.age}` : ''}
            </h2>
            <p className="small capitalize" style={{ opacity: 0.9 }}>{profile.college}</p>
          </div>
        </div>
      </div>

      {profile.bio && <div className="card"><p>{profile.bio}</p></div>}

      {profile.interests?.length > 0 && (
        <div className="chip-group">
          {profile.interests.map((i) => <span key={i} className="chip chip--soft">{i}</span>)}
        </div>
      )}

      <button className="btn btn--block" onClick={() => navigate('/onboarding?edit=1')}>
        ✏️ Edit profile
      </button>

      {/* ── Matching preferences ── */}
      <div className="card stack">
        <h3>Matching</h3>

        <div className="field">
          <span className="label">Show me</span>
          <div className="chip-group">
            {[
              ['any', 'Everyone'],
              ['male', 'Men'],
              ['female', 'Women'],
              ['non-binary', 'Non-binary'],
            ].map(([v, label]) => (
              <button
                key={v}
                className="chip chip-toggle"
                aria-pressed={pref?.preferredGender === v}
                onClick={() => savePref({ preferredGender: v })}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="hint">
            We only show people whose own filter also includes you, so an invite is never a dead end.
          </span>
        </div>

        <div className="field">
          <span className="label">In my feed</span>
          <div className="chip-group">
            {[
              ['both', 'People & tables'],
              ['solo', 'Just 1-on-1'],
              ['group', 'Just group tables'],
            ].map(([v, label]) => (
              <button
                key={v}
                className="chip chip-toggle"
                aria-pressed={pref?.openTo === v}
                onClick={() => savePref({ openTo: v })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="row-between">
          <div className="stack-sm" style={{ gap: 0 }}>
            <strong>Available for matching</strong>
            <span className="small muted">
              {pref?.isAvailable ? 'Your profile is in the deck' : 'Hidden from everyone'}
            </span>
          </div>
          <button
            className={`btn btn--sm ${pref?.isAvailable ? 'btn--go' : 'btn--ghost'}`}
            onClick={toggleAvailable}
            role="switch"
            aria-checked={Boolean(pref?.isAvailable)}
          >
            {pref?.isAvailable ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* ── About you, summarised ── */}
      <div className="card stack-sm">
        <h3>Your profile at a glance</h3>
        <div className="chip-group">
          {profile.intent && <span className="chip chip--soft">🎯 {titleCase(profile.intent)}</span>}
          {profile.foodPreference && <span className="chip chip--soft">🥗 {titleCase(profile.foodPreference)}</span>}
          {profile.personalityType && <span className="chip chip--soft">🧠 {titleCase(profile.personalityType)}</span>}
          {profile.clubs?.map((c) => <span key={c} className="chip chip--soft">🎓 {c}</span>)}
        </div>
      </div>

      <div className="card stack-sm">
        <h3>Account</h3>
        <p className="small muted">{profile.email}</p>
        <p className="small muted capitalize">{profile.college}</p>
        <button className="btn btn--ghost btn--block" onClick={logout}>Sign out</button>
      </div>

      <p className="small muted center">MessMate · built for campus meals</p>
    </main>
  );
};

export default Me;
