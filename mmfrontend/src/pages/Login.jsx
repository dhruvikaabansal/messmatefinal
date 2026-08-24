import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { useSession } from '../store/SessionContext';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [params] = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Please sign in again.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await signIn(form);
      navigate(user.isProfileComplete ? '/discover' : '/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page stack" style={{ maxWidth: 420, paddingTop: 48 }}>
      <div className="stack-sm">
        <span className="brand">MessMate 🍽️</span>
        <h1>Welcome back</h1>
        <p className="muted">Pick a meal and find someone to share it with.</p>
      </div>

      {error && <div className="banner banner--error">{error}</div>}

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="center small">
        New here? <Link to="/register" style={{ fontWeight: 700, color: 'var(--tomato)' }}>Create an account</Link>
      </p>
    </main>
  );
};

export default Login;
