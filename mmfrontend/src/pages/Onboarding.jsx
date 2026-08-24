import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api, { errorMessage } from '../lib/api';

import { useToast } from '../lib/toast';
import { useSession } from '../store/SessionContext';
import { Skeleton, SmartImg } from '../components/ui';

const INTERESTS = [
  'anime', 'k-pop', 'bollywood', 'indie music', 'hip hop', 'classical',
  'coding', 'startups', 'design', 'finance', 'robotics', 'ai',
  'cricket', 'football', 'badminton', 'gym', 'basketball', 'chess',
  'filter coffee', 'street food', 'baking', 'photography', 'poetry', 'reading',
  'trekking', 'gaming', 'dance', 'theatre', 'debate', 'volunteering',
];

/**
 * Common campus societies, offered as chips.
 *
 * Clubs used to be a free-text box. That made the signal near-useless —
 * "Dance Society", "dance soc" and "Dancing Club" are three different strings
 * that never match each other — and the comma parsing was broken anyway, so
 * only one club could ever be entered. Picking from a shared list means two
 * people in the same society actually match on it.
 */
const CLUB_CATALOG = [
  'Dance society', 'Music society', 'Dramatics society', 'Debate society',
  'Robotics club', 'Coding club', 'Entrepreneurship cell', 'Design club',
  'Photography club', 'Film club', 'Literary society', 'Quiz club',
  'Football team', 'Cricket team', 'Basketball team', 'Athletics',
  'NSS / volunteering', 'Student council', 'Fest organising team',
];

const PROMPT_QUESTIONS = [
  'My go-to mess order',
  "A hill I'll die on",
  'Best thing about this campus',
  "I'll talk for hours about",
  'My idea of a perfect lunch break',
  'Two truths and a lie',
];

const STEPS = ['You', 'Interests', 'Vibe'];

/**
 * Onboarding — three short steps, each of which saves as you go.
 *
 * The old flow asked for everything on one long page, blocked completion on a
 * photo upload, and bounced people back here even after they had filled it in
 * because four files disagreed about what "complete" meant. Completion is now
 * defined once, on the server, and reported back as `missing`.
 */
const Onboarding = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useSession();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1';

  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [birthdayLocked, setBirthdayLocked] = useState(false);

  const [form, setForm] = useState({
    name: '',
    birthday: '',
    gender: '',
    interests: [],
    clubs: [],
    bio: '',
    profilePic: '',
    intent: 'casual',
    foodPreference: '',
    personalityType: '',
    prompts: [{ question: PROMPT_QUESTIONS[0], answer: '' }],
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/user/profile');
        const p = data.profile;
        setForm((f) => ({
          ...f,
          name: p.name || '',
          birthday: p.birthday ? String(p.birthday).slice(0, 10) : '',
          gender: p.gender || '',
          interests: p.interests || [],
          clubs: p.clubs || [],
          bio: p.bio || '',
          profilePic: p.profilePic || '',
          intent: p.intent || 'casual',
          foodPreference: p.foodPreference || '',
          personalityType: p.personalityType || '',
          prompts: p.prompts?.length ? p.prompts : f.prompts,
        }));
        setBirthdayLocked(Boolean(p.birthday));
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [clubDraft, setClubDraft] = useState('');

  const sameClub = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const hasClub = (c) => form.clubs.some((x) => sameClub(x, c));

  const toggleClub = (c) =>
    setForm((f) => ({
      ...f,
      clubs: hasClub(c) ? f.clubs.filter((x) => !sameClub(x, c)) : [...f.clubs, c].slice(0, 8),
    }));

  /** Anything the user typed that isn't in the catalog, shown as removable chips. */
  const customClubs = form.clubs.filter(
    (c) => !CLUB_CATALOG.some((k) => sameClub(k, c))
  );

  const addCustomClub = () => {
    const value = clubDraft.trim().replace(/\s+/g, ' ');
    if (!value) return;
    // Match it to the catalog if it's just a casing difference.
    const known = CLUB_CATALOG.find((k) => sameClub(k, value));
    const label = known || value;
    if (!hasClub(label)) toggleClub(label);
    setClubDraft('');
  };

  const toggleInterest = (i) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(i)
        ? f.interests.filter((x) => x !== i)
        : f.interests.length >= 12
          ? f.interests
          : [...f.interests, i],
    }));

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append('profilePic', file);
    try {
      const { data } = await api.post('/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set('profilePic', data.imageUrl);
      toast.success('Photo added');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (payload) => {
    const { data } = await api.put('/user/profile', payload ?? form);
    await refresh();
    return data.profile;
  };

  /**
   * What's still missing on this step, in the words a person would use.
   *
   * The button used to sit greyed out with the requirement only in small grey
   * text beside the field. People hit it, nothing happened, and there was
   * nothing to tell them why — a silent dead end in the middle of signup. Now
   * the button always works and says exactly what it wants.
   */
  const missing = useMemo(() => {
    const gaps = [];
    if (step === 0) {
      if (!form.name.trim()) gaps.push('your name');
      if (!form.birthday) gaps.push('your birthday');
      if (!form.gender) gaps.push('your gender');
    }
    if (step === 1) {
      const short = 3 - form.interests.length;
      if (short > 0) gaps.push(`${short} more interest${short > 1 ? 's' : ''}`);
      const bio = form.bio.trim().length;
      if (bio === 0) gaps.push('a one-liner about you');
      else if (bio < 10) gaps.push(`a few more words in your one-liner (${10 - bio} to go)`);
    }
    return gaps;
  }, [step, form]);

  const stepValid = missing.length === 0;

  const next = async () => {
    if (!stepValid) {
      const list =
        missing.length === 1
          ? missing[0]
          : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
      toast.error(`Still need ${list}.`);
      return;
    }
    setSaving(true);
    try {
      await save();
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.success(editing ? 'Profile updated' : "You're all set 🎉");
        navigate(editing ? '/me' : '/discover', { replace: true });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page stack">
        <Skeleton h={10} r={999} />
        <Skeleton h={140} />
        <Skeleton h={40} />
      </main>
    );
  }

  return (
    <main className="page stack">
      <div className="steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i <= step ? 'done' : ''}`} />
        ))}
      </div>

      <div className="stack-sm">
        <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
        <h1>
          {step === 0 && (editing ? 'Your details' : 'Let’s set you up')}
          {step === 1 && 'What are you into?'}
          {step === 2 && 'How you eat'}
        </h1>
        <p className="muted">
          {step === 0 && 'This is what people see first. Keep it real — you’re meeting them at the mess.'}
          {step === 1 && 'Pick at least three. Rarer picks get you better matches than “music”.'}
          {step === 2 && 'Optional, but each one sharpens who we put in front of you.'}
        </p>
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="stack">
        {step === 0 && (
          <>
            <div className="card stack" style={{ alignItems: 'center' }}>
              <SmartImg
                className="avatar avatar--lg"
                src={form.profilePic}
                name={form.name}
                alt=""
                style={{ width: 110, height: 110 }}
              />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
              <button className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : form.profilePic ? 'Change photo' : 'Add a photo'}
              </button>
              <p className="hint center">
                Optional — but profiles with a photo get roughly twice the invites.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="bday">Birthday</label>
              <input
                id="bday"
                className="input"
                type="date"
                value={form.birthday}
                disabled={birthdayLocked}
                onChange={(e) => set('birthday', e.target.value)}
              />
              <span className="hint">
                {birthdayLocked ? 'Locked once set, so ages stay honest.' : 'Only your age is ever shown.'}
              </span>
            </div>

            <div className="field">
              <span className="label">Gender</span>
              <div className="chip-group">
                {['male', 'female', 'non-binary', 'prefer not to say'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="chip chip-toggle capitalize"
                    aria-pressed={form.gender === g}
                    onClick={() => set('gender', g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="field">
              <span className="label">
                Interests <span className="muted small">({form.interests.length}/12)</span>
              </span>
              <div className="chip-group">
                {INTERESTS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="chip chip-toggle"
                    aria-pressed={form.interests.includes(i)}
                    onClick={() => toggleInterest(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
              {form.interests.length < 3 && (
                <span className="hint">
                  Pick {3 - form.interests.length} more to continue.
                </span>
              )}
            </div>

            <div className="field">
              <label className="label" htmlFor="bio">Your one-liner</label>
              <textarea
                id="bio"
                className="textarea"
                placeholder="Third year, permanently hungry, will trade notes for parathas."
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                maxLength={180}
              />
              <span className="hint">{form.bio.length}/180 · at least 10 characters</span>
            </div>

            <div className="field">
              <span className="label">
                Clubs or societies <span className="muted small">(optional)</span>
              </span>
              <div className="chip-group">
                {CLUB_CATALOG.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="chip chip-toggle"
                    aria-pressed={hasClub(c)}
                    onClick={() => toggleClub(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {customClubs.length > 0 && (
                <div className="chip-group">
                  {customClubs.map((c) => (
                    <span key={c} className="chip chip--plum">
                      {c}
                      <button
                        type="button"
                        onClick={() => toggleClub(c)}
                        aria-label={`Remove ${c}`}
                        style={{
                          background: 'none', border: 0, cursor: 'pointer',
                          color: 'inherit', padding: 0, marginLeft: 2, fontWeight: 800,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="row" style={{ gap: 8 }}>
                <input
                  id="clubs"
                  className="input grow"
                  placeholder="Not listed? Type it and press Enter"
                  value={clubDraft}
                  onChange={(e) => setClubDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addCustomClub();
                    }
                  }}
                  maxLength={40}
                />
                <button type="button" className="btn btn--sm" onClick={addCustomClub} disabled={!clubDraft.trim()}>
                  Add
                </button>
              </div>
              <span className="hint">Being in the same society is one of the strongest match signals.</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <span className="label">Why are you here?</span>
              <div className="chip-group">
                {[
                  ['casual', 'Casual company'],
                  ['just company', "Just don't want to eat alone"],
                  ['networking', 'Meet people in my field'],
                  ['dating', 'Open to dating'],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className="chip chip-toggle"
                    aria-pressed={form.intent === v}
                    onClick={() => set('intent', v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="hint">We match people looking for the same thing.</span>
            </div>

            <div className="field">
              <span className="label">Food</span>
              <div className="chip-group">
                {['veg', 'non-veg', 'vegan'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="chip chip-toggle capitalize"
                    aria-pressed={form.foodPreference === f}
                    onClick={() => set('foodPreference', f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="label">Around new people you're…</span>
              <div className="chip-group">
                {['introvert', 'ambivert', 'extrovert'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chip chip-toggle capitalize"
                    aria-pressed={form.personalityType === p}
                    onClick={() => set('personalityType', p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="label">A prompt for your profile</span>
              <select
                className="select"
                value={form.prompts[0]?.question || PROMPT_QUESTIONS[0]}
                onChange={(e) =>
                  set('prompts', [{ ...form.prompts[0], question: e.target.value }, ...form.prompts.slice(1)])
                }
              >
                {PROMPT_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <textarea
                className="textarea"
                placeholder="Extra rice, always."
                value={form.prompts[0]?.answer || ''}
                onChange={(e) =>
                  set('prompts', [{ ...form.prompts[0], answer: e.target.value }, ...form.prompts.slice(1)])
                }
                maxLength={300}
              />
            </div>
          </>
        )}
      </motion.div>

      {missing.length > 0 && (
        <p className="hint" id="step-gaps" aria-live="polite" style={{ marginTop: -4 }}>
          To continue, add {missing.join(' · ')}
        </p>
      )}

      <div className="row">
        {step > 0 && (
          <button className="btn btn--ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
            Back
          </button>
        )}
        <button
          className="btn btn--primary grow"
          onClick={next}
          disabled={saving}
          // Deliberately NOT disabled when the step is incomplete — tapping it
          // is how people ask "what do you want from me?", and it answers.
          // aria-disabled is wrong here too: it would tell assistive tech the
          // control is unavailable when it is in fact the way to get help.
          // The gaps are announced via aria-describedby instead.
          aria-describedby={stepValid ? undefined : 'step-gaps'}
          style={stepValid ? undefined : { opacity: 0.72 }}
        >
          {saving ? 'Saving…' : step === STEPS.length - 1 ? (editing ? 'Save' : 'Start matching') : 'Continue'}
        </button>
      </div>

      {editing && (
        <button className="btn btn--ghost btn--block" onClick={() => navigate('/me')}>
          Cancel
        </button>
      )}
    </main>
  );
};

export default Onboarding;
