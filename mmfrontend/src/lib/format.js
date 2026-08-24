import { BACKEND_URL } from './api';

const AVATAR_COLORS = ['#ff5a3c', '#ffb703', '#0f9d58', '#6c3ce9', '#e6421f', '#2563eb'];

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '🍽';

/**
 * An initials avatar drawn inline as an SVG data URI.
 *
 * The old build pointed at ui-avatars.com. That is a third-party request on
 * every card: slow on campus wifi, a privacy leak, and a wall of broken image
 * icons whenever the service is unreachable. This renders instantly, offline,
 * and never fails.
 */
export const initialsAvatar = (name = 'User') => {
  const color = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="${color}"/>
    <text x="100" y="100" dy="0.35em" text-anchor="middle" fill="#fff"
      font-family="Inter, system-ui, sans-serif" font-size="82" font-weight="700">${initials(name)}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** Resolve a profile picture, falling back to a locally drawn initials avatar. */
export const profilePic = (path, name = 'User') => {
  if (path && /^https?:\/\//.test(path)) return path;
  if (path && path.startsWith('/uploads')) return `${BACKEND_URL}${path}`;
  return initialsAvatar(name);
};

export const MEALS = {
  breakfast: { label: 'Breakfast', emoji: '🍳' },
  lunch: { label: 'Lunch', emoji: '🍱' },
  snacks: { label: 'Snacks', emoji: '🥟' },
  dinner: { label: 'Dinner', emoji: '🍛' },
};

export const mealLabel = (m) => MEALS[m]?.label || m || 'Meal';
export const mealEmoji = (m) => MEALS[m]?.emoji || '🍽️';

/** "Today" / "Tomorrow" / "Sat 12 Sep" — never a raw ISO string in the UI. */
export const friendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const today = localDateStr();
  const tomorrow = localDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/** Local (not UTC) YYYY-MM-DD — the UTC version was a day behind after 5:30pm. */
export const localDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** "closes in 2h 15m" — the urgency that makes people actually act. */
export const countdown = (minutes) => {
  if (!minutes || minutes <= 0) return 'closed';
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
};

export const timeAgo = (iso) => {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

export const clockTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
