import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearToken, getToken, setToken } from '../lib/api';

/**
 * SessionContext — one source of truth for "who is signed in and are they ready
 * to match".
 *
 * The previous build re-derived this in App.jsx, Navbar.jsx, Preferences.jsx and
 * Profile.jsx with four slightly different completeness rules, which is why
 * users kept getting bounced back to the profile page after filling it in. The
 * server now owns that rule and reports it; the client just reads it.
 */

const SessionContext = createContext(null);

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
};

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getToken() ? 'loading' : 'anonymous');
  const [unread, setUnread] = useState(0);

  /**
   * Ask the server who we are. Kept async end-to-end (no synchronous state
   * writes) so it can be called from an effect without cascading renders.
   */
  const loadSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      await Promise.resolve();
      setUser(null);
      setStatus('anonymous');
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setStatus('authenticated');
      return data.user;
    } catch {
      clearToken();
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await loadSession();
      if (cancelled && me) { /* component went away mid-flight */ }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  // Poll unread counts while signed in, so the tab badge is honest without a
  // websocket. Paused when the tab is hidden to save battery and requests.
  useEffect(() => {
    if (status !== 'authenticated') return undefined;

    let stop = false;
    const tick = async () => {
      if (document.hidden || stop) return;
      try {
        const { data } = await api.get('/chat/unread');
        if (!stop) setUnread(data.total || 0);
      } catch {
        /* a failed badge refresh is not worth telling anyone about */
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [status]);

  const signIn = useCallback(
    async (credentials) => {
      const { data } = await api.post('/auth/login', credentials);
      setToken(data.token);
      setUser(data.user);
      setStatus('authenticated');
      return data.user;
    },
    []
  );

  const signUp = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      unread,
      setUnread,
      isAuthed: status === 'authenticated',
      isReady: status !== 'loading',
      profileComplete: Boolean(user?.isProfileComplete),
      signIn,
      signUp,
      signOut,
      refresh: loadSession,
    }),
    [user, status, unread, signIn, signUp, signOut, loadSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
