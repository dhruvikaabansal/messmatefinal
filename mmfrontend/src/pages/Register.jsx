import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { useSession } from '../store/SessionContext';

const COLLEGES = ['NIIT University', 'IIT Delhi', 'DTU', 'NSUT', 'SRCC', 'Other'];

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useSession();

  const [form, setForm] = useState({ name: '', email: '', password: '', college: '', otherCollege: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const college = form.college === 'Other' ? form.otherCollege.trim() : form.college;
    if (!college) return setError('Tell us which college you’re at.');
    if (form.password.length < 8) return setError('Use at least 8 characters for your password.');

    setBusy(true);
    try {
      await signUp({ name: form.name, email: form.email, password: form.password, college });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page stack" style={{ maxWidth: 420, paddingTop: 48 }}>
      <div className="stack-sm">
        <span className="brand">MessMate 🍽️</span>
        <h1>Create your account</h1>
        <p className="muted">Takes a minute. You'll be matching for your next meal right after.</p>
      </div>

      {error && <div className="banner banner--error">{error}</div>}

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required maxLength={60} />
        </div>

        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
          />
          <span className="hint">At least 8 characters.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="college">College</label>
          <select id="college" className="select" value={form.college} onChange={set('college')} required>
            <option value="">Select your college</option>
            {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="hint">You'll only ever be shown people from here.</span>
        </div>

        {form.college === 'Other' && (
          <div className="field">
            <label className="label" htmlFor="other">Which one?</label>
            <input id="other" className="input" value={form.otherCollege} onChange={set('otherCollege')} required />
          </div>
        )}

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="center small">
        Already here? <Link to="/login" style={{ fontWeight: 700, color: 'var(--tomato)' }}>Log in</Link>
      </p>
    </main>
  );
};

export default Register;
