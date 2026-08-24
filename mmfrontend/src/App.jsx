import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider, useSession } from './store/SessionContext';
import { ToastProvider } from './lib/toast';
import AppShell from './components/AppShell';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Discover from './pages/Discover';
import Likes from './pages/Likes';
import Inbox from './pages/Inbox';
import Thread from './pages/Thread';
import Me from './pages/Me';

const Booting = () => (
  <div className="page stack" style={{ paddingTop: 80, alignItems: 'center' }}>
    <div className="spinner" />
    <p className="muted small">Getting your table ready…</p>
  </div>
);

/** Signed-in only. Sends people to onboarding until their profile is usable. */
const Private = ({ children, needsProfile = true }) => {
  const { isReady, isAuthed, profileComplete } = useSession();
  const location = useLocation();

  if (!isReady) return <Booting />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (needsProfile && !profileComplete) return <Navigate to="/onboarding" replace />;
  return children;
};

/** Signed-out only — keeps logged-in users out of the auth screens. */
const Public = ({ children }) => {
  const { isReady, isAuthed } = useSession();
  if (!isReady) return <Booting />;
  if (isAuthed) return <Navigate to="/discover" replace />;
  return children;
};

const Router = () => (
  <AppShell>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/register" element={<Public><Register /></Public>} />

      <Route path="/onboarding" element={<Private needsProfile={false}><Onboarding /></Private>} />
      <Route path="/discover" element={<Private><Discover /></Private>} />
      <Route path="/likes" element={<Private><Likes /></Private>} />
      <Route path="/inbox" element={<Private><Inbox /></Private>} />
      <Route path="/inbox/:threadType/:threadId" element={<Private><Thread /></Private>} />
      <Route path="/me" element={<Private needsProfile={false}><Me /></Private>} />

      {/* Old URLs people may have bookmarked or shared. */}
      <Route path="/home" element={<Navigate to="/discover" replace />} />
      <Route path="/matches" element={<Navigate to="/inbox" replace />} />
      <Route path="/community" element={<Navigate to="/discover" replace />} />
      <Route path="/preferences" element={<Navigate to="/me" replace />} />
      <Route path="/profile" element={<Navigate to="/onboarding" replace />} />
      <Route path="/profile/preview" element={<Navigate to="/me" replace />} />
      <Route path="/start" element={<Navigate to="/discover" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppShell>
);

const App = () => (
  <BrowserRouter>
    <SessionProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </SessionProvider>
  </BrowserRouter>
);

export default App;
