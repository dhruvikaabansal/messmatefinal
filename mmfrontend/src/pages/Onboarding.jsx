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

  const stepValid = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim() && form.birthday && form.gender);
    if (step === 1) return form.interests.length >= 3 && form.bio.trim().length >= 10;
    return true;
  }, [step, form]);

  const next = async () => {
    if (!stepValid) return;
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
                <span className="hint">Pick {3 - form.interests.length} more to continue.</span>
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
              <label className="label" htmlFor="clubs">Clubs or societies</label>
              <input
                id="clubs"
                className="input"
                placeholder="Robotics club, Dance society"
                value={form.clubs.join(', ')}
                onChange={(e) => set('clubs', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))}
              />
              <span className="hint">Comma separated. Shared clubs are a strong match signal.</span>
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

      <div className="row">
        {step > 0 && (
          <button className="btn btn--ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
            Back
          </button>
        )}
        <button className="btn btn--primary grow" onClick={next} disabled={!stepValid || saving}>
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
