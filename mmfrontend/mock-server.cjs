/**
 * mock-server.js — a stand-in API for looking at the UI without MongoDB.
 *
 * Not part of the app. Handy for design review and screenshots:
 *   node mock-server.js            (port 5055)
 *   VITE_API_URL=http://localhost:5055/api npm run dev
 */
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const todayStr = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000 + 5.5 * 3600000);
  return d.toISOString().slice(0, 10);
};

const MEALS = [
  ['breakfast', 'Breakfast', '🍳', '7:00 – 10:00 AM'],
  ['lunch', 'Lunch', '🍱', '12:00 – 3:00 PM'],
  ['snacks', 'Snacks', '🥟', '4:00 – 6:00 PM'],
  ['dinner', 'Dinner', '🍛', '7:00 – 10:00 PM'],
];

const slots = () =>
  [0, 1].flatMap((day) =>
    MEALS.map(([mealTime, label, emoji, window]) => ({
      slotId: `${todayStr(day)}_${mealTime}`,
      mealDate: todayStr(day),
      mealTime,
      isToday: day === 0,
      label,
      emoji,
      window,
      isOpen: day === 1 || mealTime !== 'breakfast',
      minutesLeft: day === 1 ? 900 : 137,
    }))
  );

const person = (i, over = {}) => ({
  kind: 'person',
  _id: `u${i}`,
  name: ['Aarav Menon', 'Ishita Rao', 'Kabir Sethi', 'Meera Nair', 'Rohan Das'][i % 5],
  age: 19 + (i % 4),
  gender: i % 2 ? 'male' : 'female',
  college: 'niit university',
  bio: [
    'Third year, permanently hungry, will trade notes for parathas.',
    'Runs on filter coffee and last-minute submissions.',
    'Looking for someone to argue about football with over dinner.',
  ][i % 3],
  interests: ['filter coffee', 'anime', 'badminton', 'coding', 'poetry'].slice(0, 3 + (i % 3)),
  sharedInterests: ['filter coffee', 'anime'],
  intent: 'casual',
  foodPreference: ['veg', 'non-veg', 'vegan'][i % 3],
  personalityType: ['introvert', 'ambivert', 'extrovert'][i % 3],
  profilePic: '',
  prompts: [
    { question: 'My go-to mess order', answer: 'Extra rice, always.' },
    { question: "A hill I'll die on", answer: 'Filter coffee > everything.' },
  ],
  matchScore: 88 - i * 7,
  likedMe: i === 0,
  isActiveNow: i < 2,
  reasons: [
    { icon: '✨', text: 'Both into filter coffee & anime' },
    { icon: '🎯', text: 'Also here for casual company' },
    { icon: '🎂', text: 'Same year group' },
  ].slice(0, 3 - (i % 2)),
  outsideYourFilter: false,
  ...over,
});

const table = (i, over = {}) => ({
  kind: 'table',
  _id: `t${i}`,
  name: ['Late lunch, loud table', 'Assignment panic + chai'][i % 2],
  description: 'Come complain with us. Bring your laptop, or don’t.',
  venue: 'Mess 2, near the window',
  interests: ['coding', 'chai'],
  mealTime: 'lunch',
  mealDate: todayStr(),
  maxMembers: 4,
  seatsLeft: 1,
  isFull: false,
  members: [
    { _id: 'm1', name: 'Nikhil Verma', profilePic: '' },
    { _id: 'm2', name: 'Sara Qureshi', profilePic: '' },
    { _id: 'm3', name: 'Dev Patel', profilePic: '' },
  ],
  createdBy: { _id: 'm1', name: 'Nikhil Verma' },
  reasons: [
    { icon: '🔥', text: 'Last seat left' },
    { icon: '🤝', text: "You'd fit right in" },
  ],
  ...over,
});

const state = { view: process.env.MOCK_VIEW || 'deck' };

const user = {
  id: 'me',
  name: 'Dhruvika Bansal',
  email: 'dhruvika@niit.edu',
  college: 'niit university',
  profilePic: '',
  isProfileComplete: true,
};

app.post('/api/auth/login', (_q, res) => res.json({ token: 'mock', user }));
app.post('/api/auth/register', (_q, res) => res.status(201).json({ token: 'mock', user }));
app.get('/api/auth/me', (_q, res) => res.json({ user, hasPreferences: true, nextStep: 'discover' }));

app.get('/api/chat/unread', (_q, res) => res.json({ total: 3, threads: [] }));

app.get('/api/slot/status', (_q, res) => {
  const people = [0, 1, 2, 3].map((i) => person(i));
  const tables = [table(0)];
  const base = {
    slotId: `${todayStr()}_lunch`,
    mealDate: todayStr(),
    mealTime: 'lunch',
    slotStatus: 'active',
    minutesLeft: 137,
    userId: 'me',
    openTo: 'both',
    slots: slots(),
    expandedSearch: false,
    unread: 2,
    profileComplete: true,
    people,
    tables,
    likesReceived: [
      { ...person(0), likeId: 'l1', likedAt: new Date(Date.now() - 900000).toISOString() },
      { ...person(2), likeId: 'l2', likedAt: new Date(Date.now() - 5400000).toISOString() },
    ],
    matchData: null,
    communityData: null,
  };

  if (state.view === 'matched') {
    return res.json({
      ...base,
      state: 'matched',
      feed: [],
      matchData: {
        _id: 'match1',
        mealTime: 'lunch',
        mealDate: todayStr(),
        status: 'active',
        user: person(1),
      },
    });
  }
  if (state.view === 'table') {
    return res.json({
      ...base,
      state: 'in_community',
      feed: [],
      communityData: { ...table(0), seatsLeft: 1 },
    });
  }
  if (state.view === 'empty') {
    return res.json({ ...base, state: 'idle', people: [], tables: [], feed: [] });
  }
  return res.json({ ...base, state: 'idle', feed: [...people.slice(0, 4), tables[0]] });
});

app.post('/api/slot/switch', (_q, res) => res.json({ message: 'ok' }));

app.get('/api/preferences', (_q, res) =>
  res.json({
    preference: {
      mealTime: 'lunch',
      mealDate: todayStr(),
      preferredGender: 'any',
      openTo: 'both',
      groupSize: 4,
      isAvailable: true,
    },
    slots: slots(),
  })
);
app.put('/api/preferences', (req, res) => res.json({ preference: { ...req.body, mealTime: 'lunch', mealDate: todayStr() } }));

app.get('/api/user/profile', (_q, res) =>
  res.json({
    profile: {
      ...user,
      birthday: '2004-05-12',
      age: 21,
      gender: 'female',
      interests: ['filter coffee', 'anime', 'poetry', 'badminton'],
      clubs: ['Robotics club'],
      intent: 'casual',
      personalityType: 'ambivert',
      foodPreference: 'veg',
      bio: 'Final year. Will absolutely walk 15 minutes for better chai.',
      prompts: [{ question: 'My go-to mess order', answer: 'Extra rice, always.' }],
      isAvailable: true,
      isProfileComplete: true,
      missing: [],
      preferences: null,
    },
  })
);
app.put('/api/user/profile', (_q, res) => res.json({ profile: { ...user, missing: [] } }));

app.get('/api/match/list', (_q, res) =>
  res.json({
    matches: [
      {
        _id: 'match1',
        status: 'active',
        mealTime: 'lunch',
        mealDate: todayStr(),
        unread: 2,
        lastMessageAt: new Date(Date.now() - 240000).toISOString(),
        lastMessagePreview: 'Mess 2 at 1:15? I’ll grab a table.',
        user: person(1),
      },
      {
        _id: 'match0',
        status: 'completed',
        mealTime: 'dinner',
        mealDate: todayStr(-1),
        unread: 0,
        user: person(3),
      },
    ],
  })
);

app.get('/api/community', (_q, res) =>
  res.json({
    myTables: [
      {
        ...table(1),
        isMember: true,
        lastMessageAt: new Date(Date.now() - 900000).toISOString(),
        lastMessagePreview: 'Nikhil: on my way',
      },
    ],
    communities: [table(0)],
  })
);

const messages = [
  { _id: 'm0', kind: 'system', text: 'You matched for lunch. Say hi and decide where to meet!', createdAt: new Date(Date.now() - 900000).toISOString(), mine: false, sender: null },
  { _id: 'm1', text: 'Hey! Mess 2 or the food court?', createdAt: new Date(Date.now() - 600000).toISOString(), mine: false, sender: { _id: 'u1', name: 'Ishita Rao' } },
  { _id: 'm2', text: 'Mess 2 works. 1:15?', createdAt: new Date(Date.now() - 420000).toISOString(), mine: true, sender: { _id: 'me', name: 'Dhruvika' } },
  { _id: 'm3', text: 'Perfect, I’ll grab a table near the window 🪟', createdAt: new Date(Date.now() - 240000).toISOString(), mine: false, sender: { _id: 'u1', name: 'Ishita Rao' } },
];

app.get('/api/chat/:type/:id', (req, res) =>
  res.json({
    threadType: req.params.type,
    threadId: req.params.id,
    title: req.params.type === 'community' ? 'Assignment panic + chai' : 'Ishita Rao',
    messages: req.query.after ? [] : messages,
    serverTime: new Date().toISOString(),
  })
);
app.post('/api/chat/:type/:id', (req, res) =>
  res.status(201).json({
    message: { _id: `x${Date.now()}`, text: req.body.text, createdAt: new Date().toISOString(), mine: true, sender: { _id: 'me', name: 'Dhruvika' } },
  })
);

app.post('/api/match/:action', (_q, res) => res.json({ isMatch: false, message: 'ok' }));
app.post('/api/community/:action', (_q, res) => res.json({ message: 'ok', community: table(0) }));

app.listen(process.env.PORT || 5055, () =>
  console.log(`mock API on ${process.env.PORT || 5055} (view=${state.view})`)
);
