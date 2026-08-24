/**
 * e2e.js — end-to-end smoke test against a real (in-memory) MongoDB.
 *
 * Run with:  npm test
 *
 * Covers the whole user journey plus the concurrency and authorisation cases
 * that are easy to get wrong: simultaneous mutual likes, racing for the last
 * seat at a table, and trying to act on someone else's match.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-messmate";

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let passed = 0;
let failed = 0;
const failures = [];

const check = (name, condition, detail = "") => {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`);

let skipped = 0;
/** Whether the database serialises concurrent single-document updates. */
let atomicDocs = true;

/**
 * Concurrency assertions only mean something on a backend that guarantees
 * atomic single-document updates (real MongoDB does). Some MongoDB-compatible
 * backends lose one of two concurrent writes, which would make these fail for
 * reasons that have nothing to do with the application.
 */
const checkConcurrent = (name, condition, detail = "") => {
  if (!atomicDocs) {
    skipped++;
    console.log(`  ~ ${name} — skipped (backend lacks atomic document updates)`);
    return;
  }
  check(name, condition, detail);
};

/** Two concurrent conditional updates; on a correct backend exactly one wins. */
const probeAtomicity = async () => {
  const Probe = mongoose.model(
    "AtomicityProbe",
    new mongoose.Schema({ n: Number }, { versionKey: false })
  );
  await Probe.deleteMany({});
  const doc = await Probe.create({ n: 0 });
  const winners = (
    await Promise.all(
      [1, 2].map(() =>
        Probe.findOneAndUpdate({ _id: doc._id, n: 0 }, { $set: { n: 1 } }, { returnDocument: "after" })
      )
    )
  ).filter(Boolean);
  await Probe.deleteMany({});
  return winners.length === 1;
};

let BASE = "";

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
};

const INTERESTS = [
  ["anime", "coding", "filter coffee", "badminton"],
  ["anime", "coding", "chess", "filter coffee"],
  ["football", "gym", "hip hop", "chess"],
  ["anime", "poetry", "filter coffee", "trekking"],
  ["gym", "football", "coding", "startups"],
];

const makeUser = async (i, { gender, college = "niit university", intent = "casual" } = {}) => {
  const email = `user${i}@test.edu`;
  const reg = await api("POST", "/api/auth/register", {
    body: { name: `User ${i}`, email, password: "password123", college },
  });
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.data)}`);
  const token = reg.data.token;

  const birthYear = 2004 - (i % 4);
  await api("PUT", "/api/user/profile", {
    token,
    body: {
      birthday: `${birthYear}-05-1${i % 9}`,
      gender,
      interests: INTERESTS[i % INTERESTS.length],
      clubs: i % 2 ? ["dance society"] : ["robotics club"],
      intent,
      personalityType: ["introvert", "extrovert", "ambivert"][i % 3],
      foodPreference: ["veg", "non-veg", "vegan"][i % 3],
      bio: `I am user ${i} and I like eating with people.`,
      profilePic: "",
      prompts: [{ question: "My go-to mess order", answer: "Extra rice, always" }],
    },
  });

  return { i, email, token, id: reg.data.user.id };
};

/**
 * Uses an existing MongoDB when MONGO_URI is set (handy in CI or against a
 * scratch Atlas database), otherwise spins up an in-memory one.
 */
const startMongo = async () => {
  if (process.env.MONGO_URI) {
    console.log("Using MONGO_URI from the environment.");
    return { stop: async () => {} };
  }
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("messmate_test");
  return mongo;
};

const run = async () => {
  const mongo = await startMongo();

  const app = require("../server");
  await new Promise((r) => setTimeout(r, 600)); // let connectDB settle

  const server = app.listen(0);
  await new Promise((r) => server.on("listening", r));
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    atomicDocs = await probeAtomicity();
    if (!atomicDocs) {
      console.log("\n! This database does not serialise concurrent single-document updates.");
      console.log("  Concurrency assertions will be skipped. Run against MongoDB to exercise them.");
    }

    // ── SLOT UTILITIES ──────────────────────────────────────────────────
    section("Slot utilities");
    const slotUtils = require("../utils/slotUtils");
    const { dateStr, hour } = slotUtils.getISTNow();
    check("IST date is well formed", /^\d{4}-\d{2}-\d{2}$/.test(dateStr), dateStr);
    check("IST hour in range", hour >= 0 && hour <= 23, String(hour));
    check(
      "a far-future slot is active",
      slotUtils.isSlotActive(`${slotUtils.shiftDateStr(dateStr, 5)}_lunch`)
    );
    check(
      "yesterday's dinner is closed",
      !slotUtils.isSlotActive(`${slotUtils.shiftDateStr(dateStr, -1)}_dinner`)
    );
    const next = slotUtils.nextOpenSlot();
    check("nextOpenSlot returns an open slot", slotUtils.isSlotActive(
      slotUtils.buildSlotId(next.mealDate, next.mealTime)
    ), JSON.stringify(next));

    // ── MATCHING ENGINE ─────────────────────────────────────────────────
    section("Matching engine");
    const { buildIdf, scoreCandidate, genderCompatible } = require("../utils/matching");
    const pool = [
      { interests: ["anime", "coding", "music"] },
      { interests: ["music", "gym"] },
      { interests: ["music", "chess"] },
      { interests: ["music", "football"] },
    ];
    const idf = buildIdf(pool);
    check("rare interests outweigh common ones", idf.get("anime") > idf.get("music"));

    const viewer = { _id: "a", interests: ["anime", "coding"], age: 20, intent: "casual", foodPreference: "veg" };
    const twin = { _id: "b", interests: ["anime", "coding"], age: 20, intent: "casual", foodPreference: "veg" };
    const stranger = { _id: "c", interests: ["gym"], age: 29, intent: "dating", foodPreference: "non-veg" };
    const sTwin = scoreCandidate({ viewer, candidate: twin, idf, slotId: "s" });
    const sStranger = scoreCandidate({ viewer, candidate: stranger, idf, slotId: "s" });
    check("a close match outranks a stranger", sTwin.score > sStranger.score, `${sTwin.score} vs ${sStranger.score}`);
    check("a stranger still scores above zero", sStranger.score > 0, String(sStranger.score));
    check("close match produces reasons", sTwin.reasons.length > 0);

    const withLike = scoreCandidate({ viewer, candidate: stranger, idf, likedMe: true, slotId: "s" });
    check("someone who liked you is boosted", withLike.score > sStranger.score);

    const damped = scoreCandidate({ viewer, candidate: twin, idf, popularity: 10, poolPopularity: 10, slotId: "s" });
    check("popular profiles are damped", damped.score < sTwin.score, `${damped.score} vs ${sTwin.score}`);

    const a = scoreCandidate({ viewer, candidate: twin, idf, slotId: "s" });
    check("scoring is deterministic", a.score === sTwin.score);

    check(
      "gender filter is two-way",
      genderCompatible(
        { gender: "female" }, { preferredGender: "male" },
        { gender: "male" }, { preferredGender: "female" }
      ) === true &&
      genderCompatible(
        { gender: "female" }, { preferredGender: "male" },
        { gender: "male" }, { preferredGender: "male" }
      ) === false
    );

    // ── AUTH ────────────────────────────────────────────────────────────
    section("Auth");
    const bad = await api("POST", "/api/auth/register", {
      body: { name: "x", email: "not-an-email", password: "short", college: "x" },
    });
    check("rejects a malformed email", bad.status === 400);

    const users = [];
    for (let i = 0; i < 6; i++) {
      users.push(await makeUser(i, { gender: i % 2 === 0 ? "female" : "male" }));
    }
    check("registered 6 users", users.length === 6);

    const dup = await api("POST", "/api/auth/register", {
      body: { name: "Dup", email: "user0@test.edu", password: "password123", college: "niit university" },
    });
    check("duplicate email is rejected", dup.status === 409);

    const login = await api("POST", "/api/auth/login", {
      body: { email: "user0@test.edu", password: "password123" },
    });
    check("login succeeds", login.status === 200 && Boolean(login.data.token));

    const wrongPw = await api("POST", "/api/auth/login", {
      body: { email: "user0@test.edu", password: "wrongpassword" },
    });
    check("wrong password is rejected", wrongPw.status === 401);

    const noToken = await api("GET", "/api/slot/status");
    check("protected route needs a token", noToken.status === 401);

    const me = await api("GET", "/api/auth/me", { token: users[0].token });
    check("profile is complete after setup", me.data.user.isProfileComplete === true, JSON.stringify(me.data.user));

    // ── PROFILE VALIDATION ──────────────────────────────────────────────
    section("Profile rules");
    const badAge = await api("PUT", "/api/user/profile", {
      token: users[0].token,
      body: { birthday: "2020-01-01" },
    });
    check("rejects an implausible age", badAge.status === 400);

    const rebirth = await api("PUT", "/api/user/profile", {
      token: users[0].token,
      body: { birthday: "1999-01-01" },
    });
    check("birthday cannot be changed once set", rebirth.status === 400);

    const sameBirthday = await api("PUT", "/api/user/profile", {
      token: users[0].token,
      body: { birthday: "2004-05-10", bio: "Updated bio for user zero." },
    });
    check("re-saving the same birthday is fine", sameBirthday.status === 200, JSON.stringify(sameBirthday.data?.message));

    const badEnum = await api("PUT", "/api/user/profile", {
      token: users[0].token,
      body: { intent: "world domination" },
    });
    check("rejects an invalid enum", badEnum.status === 400);

    // ── PREFERENCES & SLOTS ─────────────────────────────────────────────
    section("Preferences & slots");
    const prefRes = await api("GET", "/api/preferences", { token: users[0].token });
    check("new users start on an open slot", prefRes.data.preference && slotUtils.isSlotActive(
      slotUtils.buildSlotId(prefRes.data.preference.mealDate, prefRes.data.preference.mealTime)
    ), JSON.stringify(prefRes.data.preference));
    check("new users are open to both modes", prefRes.data.preference.openTo === "both");

    const past = await api("PUT", "/api/preferences", {
      token: users[0].token,
      body: { mealDate: "2020-01-01", mealTime: "lunch" },
    });
    check("refuses to save a dead slot", past.status === 400);

    // Put everyone on the same open slot.
    const slot = slotUtils.nextOpenSlot();
    for (const u of users) {
      await api("POST", "/api/slot/switch", {
        token: u.token,
        body: { date: slot.mealDate, mealType: slot.mealTime },
      });
    }

    // ── FEED ────────────────────────────────────────────────────────────
    section("Discovery feed");
    const feed = await api("GET", "/api/slot/status", { token: users[0].token });
    check("slot status returns 200", feed.status === 200, JSON.stringify(feed.data?.message));
    check("state starts idle", feed.data.state === "idle");
    check("feed is populated", feed.data.people.length > 0, `got ${feed.data.people?.length}`);
    check("feed is ranked descending", feed.data.people.every((p, i, arr) =>
      i === 0 || arr[i - 1].matchScore >= p.matchScore));
    check("cards carry reasons", feed.data.people.some((p) => p.reasons.length > 0));
    check("no password ever leaks", !JSON.stringify(feed.data).includes("password"));
    check("slot picker is included", Array.isArray(feed.data.slots) && feed.data.slots.length === 8);

    // Gender preference must hide incompatible people from BOTH sides.
    await api("PUT", "/api/preferences", {
      token: users[0].token,
      body: { preferredGender: "male" },
    });
    const filtered = await api("GET", "/api/slot/status", { token: users[0].token });
    const inStrict = filtered.data.people.filter((p) => !p.outsideYourFilter);
    check("strict tier respects gender preference", inStrict.every((p) => p.gender === "male"),
      JSON.stringify(inStrict.map((p) => p.gender)));
    await api("PUT", "/api/preferences", { token: users[0].token, body: { preferredGender: "any" } });

    // ── LIKE / MATCH ────────────────────────────────────────────────────
    section("Like and match");
    const like1 = await api("POST", "/api/match/like", {
      token: users[0].token,
      body: { targetUserId: users[1].id },
    });
    check("first like is one-sided", like1.status === 201 && like1.data.isMatch === false);

    const dupLike = await api("POST", "/api/match/like", {
      token: users[0].token,
      body: { targetUserId: users[1].id },
    });
    check("re-liking does not double-match", dupLike.data.isMatch !== true || dupLike.status === 409);

    const incoming = await api("GET", "/api/match/likes-received", { token: users[1].token });
    check("recipient sees the like", incoming.data.likes.length === 1);

    const like2 = await api("POST", "/api/match/like", {
      token: users[1].token,
      body: { targetUserId: users[0].id },
    });
    check("mutual like creates a match", like2.status === 201 && like2.data.isMatch === true,
      JSON.stringify(like2.data));

    const matchId = like2.data.matchId;
    const afterMatch = await api("GET", "/api/slot/status", { token: users[0].token });
    check("both sides are locked to matched", afterMatch.data.state === "matched");
    check("match payload names the partner", afterMatch.data.matchData?.user?.name === "User 1",
      JSON.stringify(afterMatch.data.matchData?.user?.name));

    const blockedLike = await api("POST", "/api/match/like", {
      token: users[0].token,
      body: { targetUserId: users[2].id },
    });
    check("a matched user cannot like again", blockedLike.status === 409);

    const matchedOneHidden = await api("GET", "/api/slot/status", { token: users[3].token });
    check("matched users leave everyone else's deck",
      !matchedOneHidden.data.people.some((p) => p._id === users[0].id || p._id === users[1].id));

    // Exactly one Match document exists for this pair.
    const MatchModel = require("../models/Match");
    check("exactly one match document", (await MatchModel.countDocuments({ status: "active" })) === 1);

    // ── SIMULTANEOUS MUTUAL LIKE ────────────────────────────────────────
    section("Race: simultaneous mutual like");
    const [r1, r2] = await Promise.all([
      api("POST", "/api/match/like", { token: users[2].token, body: { targetUserId: users[3].id } }),
      api("POST", "/api/match/like", { token: users[3].token, body: { targetUserId: users[2].id } }),
    ]);
    const activeMatches = await MatchModel.countDocuments({ status: "active" });
    checkConcurrent("no duplicate match from a simultaneous like", activeMatches === 2,
      `${activeMatches} active matches; ${r1.status}/${r2.status}`);
    const s2 = await api("GET", "/api/slot/status", { token: users[2].token });
    const s3 = await api("GET", "/api/slot/status", { token: users[3].token });
    checkConcurrent("both racers end up matched", s2.data.state === "matched" && s3.data.state === "matched",
      `${s2.data.state}/${s3.data.state}`);
    checkConcurrent("they are matched to each other",
      s2.data.matchData?._id === s3.data.matchData?._id);

    // ── CHAT ────────────────────────────────────────────────────────────
    section("Chat");
    const send = await api("POST", `/api/chat/match/${matchId}`, {
      token: users[0].token,
      body: { text: "Mess at 1:15?" },
    });
    check("can send a message", send.status === 201);

    const empty = await api("POST", `/api/chat/match/${matchId}`, {
      token: users[0].token,
      body: { text: "   " },
    });
    check("empty messages are rejected", empty.status === 400);

    const outsider = await api("GET", `/api/chat/match/${matchId}`, { token: users[4].token });
    check("outsiders cannot read the thread", outsider.status === 403);

    const outsiderPost = await api("POST", `/api/chat/match/${matchId}`, {
      token: users[4].token,
      body: { text: "hello?" },
    });
    check("outsiders cannot post", outsiderPost.status === 403);

    const unreadBefore = await api("GET", "/api/chat/unread", { token: users[1].token });
    check("unread count reaches the partner", unreadBefore.data.total >= 1, JSON.stringify(unreadBefore.data));

    const thread = await api("GET", `/api/chat/match/${matchId}`, { token: users[1].token });
    check("thread includes the system + user message", thread.data.messages.length >= 2);
    check("mine flag is correct", thread.data.messages.find((m) => m.text === "Mess at 1:15?")?.mine === false);

    const unreadAfter = await api("GET", "/api/chat/unread", { token: users[1].token });
    check("reading clears unread", unreadAfter.data.total === 0, JSON.stringify(unreadAfter.data));

    // ── AUTHORISATION ───────────────────────────────────────────────────
    section("Authorisation");
    const steal = await api("POST", "/api/match/unmatch", {
      token: users[4].token,
      body: { matchId },
    });
    check("cannot unmatch someone else's match", steal.status === 404);

    const stealComplete = await api("POST", "/api/match/complete", {
      token: users[4].token,
      body: { matchId },
    });
    check("cannot complete someone else's match", stealComplete.status === 404);

    const likeRow = await require("../models/Like").findOne({ toUser: users[1].id });
    if (likeRow) {
      const stealIgnore = await api("POST", "/api/match/ignore", {
        token: users[4].token,
        body: { likeId: likeRow._id.toString() },
      });
      check("cannot dismiss someone else's like", stealIgnore.status === 404);
    }

    const injection = await api("POST", "/api/auth/login", {
      body: { email: { $ne: null }, password: { $ne: null } },
    });
    check("operator injection is stripped", injection.status === 400 || injection.status === 401,
      String(injection.status));

    // ── GROUP TABLES ────────────────────────────────────────────────────
    section("Group tables");
    const table = await api("POST", "/api/community/create", {
      token: users[4].token,
      body: { name: "Corner table", description: "Chai and chaos", maxMembers: 2, venue: "Mess 2" },
    });
    check("can create a table without changing group size first", table.status === 201,
      JSON.stringify(table.data?.message));
    const tableId = table.data.community._id;

    const creatorState = await api("GET", "/api/slot/status", { token: users[4].token });
    check("creator is seated", creatorState.data.state === "in_community");
    check("creator sees the table payload", creatorState.data.communityData?.name === "Corner table");

    const browse = await api("GET", "/api/community", { token: users[5].token });
    check("others can see the table", browse.data.communities.some((c) => c._id === tableId));

    const join = await api("POST", "/api/community/join", {
      token: users[5].token,
      body: { communityId: tableId },
    });
    check("can join a table", join.status === 200, JSON.stringify(join.data?.message));

    const extra = await makeUser(9, { gender: "female" });
    await api("POST", "/api/slot/switch", {
      token: extra.token,
      body: { date: slot.mealDate, mealType: slot.mealTime },
    });
    const overflow = await api("POST", "/api/community/join", {
      token: extra.token,
      body: { communityId: tableId },
    });
    check("a full table refuses more people", overflow.status === 409, String(overflow.status));

    const groupChat = await api("POST", `/api/chat/community/${tableId}`, {
      token: users[5].token,
      body: { text: "On my way" },
    });
    check("table chat works", groupChat.status === 201);

    const leave = await api("POST", "/api/community/leave", {
      token: users[5].token,
      body: { communityId: tableId },
    });
    check("can leave a table", leave.status === 200);
    const afterLeave = await api("GET", "/api/slot/status", { token: users[5].token });
    check("leaving frees you to match again", afterLeave.data.state === "idle");

    const notHost = await api("POST", "/api/community/dissolve", {
      token: users[5].token,
      body: { communityId: tableId },
    });
    check("only the host can close a table", notHost.status === 403);

    const dissolve = await api("POST", "/api/community/dissolve", {
      token: users[4].token,
      body: { communityId: tableId },
    });
    check("host can close the table", dissolve.status === 200);
    const afterDissolve = await api("GET", "/api/slot/status", { token: users[4].token });
    check("closing frees the host", afterDissolve.data.state === "idle");

    // ── RACE: LAST SEAT ─────────────────────────────────────────────────
    section("Race: last seat at a table");
    const t2 = await api("POST", "/api/community/create", {
      token: users[4].token,
      body: { name: "Race table", maxMembers: 2 },
    });
    const t2Id = t2.data.community._id;
    const racerA = await makeUser(20, { gender: "male" });
    const racerB = await makeUser(21, { gender: "female" });
    for (const r of [racerA, racerB]) {
      await api("POST", "/api/slot/switch", {
        token: r.token,
        body: { date: slot.mealDate, mealType: slot.mealTime },
      });
    }
    const [j1, j2] = await Promise.all([
      api("POST", "/api/community/join", { token: racerA.token, body: { communityId: t2Id } }),
      api("POST", "/api/community/join", { token: racerB.token, body: { communityId: t2Id } }),
    ]);
    const okCount = [j1, j2].filter((r) => r.status === 200).length;
    checkConcurrent(
      "exactly one racer gets the last seat",
      okCount === 1,
      `${j1.status}:${j1.data?.message} | ${j2.status}:${j2.data?.message}`
    );
    const CommunityModel = require("../models/Community");
    const t2doc = await CommunityModel.findById(t2Id).lean();
    checkConcurrent("table never exceeds capacity", t2doc.members.length === 2, `${t2doc.members.length} members`);

    // ── UNMATCH / COMPLETE ──────────────────────────────────────────────
    section("Unmatch and complete");
    const unmatch = await api("POST", "/api/match/unmatch", {
      token: users[0].token,
      body: { matchId },
    });
    check("owner can unmatch", unmatch.status === 200);
    const afterUnmatch = await api("GET", "/api/slot/status", { token: users[1].token });
    check("both sides return to idle", afterUnmatch.data.state === "idle");
    check("chat is cleaned up with the match",
      (await require("../models/Message").countDocuments({ threadId: matchId })) === 0);

    const reMatchable = await api("GET", "/api/slot/status", { token: users[0].token });
    check("unmatched pair can find each other again",
      reMatchable.data.people.some((p) => p._id === users[1].id),
      JSON.stringify(reMatchable.data.people.map((p) => p.name)));

    // ── UNDO ────────────────────────────────────────────────────────────
    section("Undo a skip");
    await api("POST", "/api/match/skip", { token: users[0].token, body: { targetUserId: users[5].id } });
    const gone = await api("GET", "/api/slot/status", { token: users[0].token });
    check("skipped profile leaves the deck", !gone.data.people.some((p) => p._id === users[5].id));
    const undo = await api("POST", "/api/match/undo", { token: users[0].token });
    check("undo succeeds", undo.status === 200);
    const back = await api("GET", "/api/slot/status", { token: users[0].token });
    check("undone profile returns", back.data.people.some((p) => p._id === users[5].id));

    // ── CLEANUP JOB ─────────────────────────────────────────────────────
    section("Expiry job");
    const { buildExpiredSlotIds, runAutoCleanup } = require("../utils/cleanup");
    const expiredIds = buildExpiredSlotIds();
    check("expired slot list never includes an open slot",
      !expiredIds.some((id) => slotUtils.isSlotActive(id)));
    // A deterministic match in the CURRENT slot: cleanup must not touch it.
    const keepA = await makeUser(40, { gender: "female" });
    const keepB = await makeUser(41, { gender: "male" });
    for (const u of [keepA, keepB]) {
      await api("POST", "/api/slot/switch", {
        token: u.token,
        body: { date: slot.mealDate, mealType: slot.mealTime },
      });
    }
    await api("POST", "/api/match/like", { token: keepA.token, body: { targetUserId: keepB.id } });
    await api("POST", "/api/match/like", { token: keepB.token, body: { targetUserId: keepA.id } });

    const summary = await runAutoCleanup();
    check("cleanup runs without error", typeof summary === "object");
    const stillMatched = await api("GET", "/api/slot/status", { token: keepA.token });
    check("cleanup leaves the current slot alone", stillMatched.data.state === "matched",
      stillMatched.data.state);

    // ── EMPTY-STATE SAFETY ──────────────────────────────────────────────
    section("Empty states");
    const lonely = await makeUser(30, { gender: "male", college: "some other college" });
    await api("POST", "/api/slot/switch", {
      token: lonely.token,
      body: { date: slot.mealDate, mealType: slot.mealTime },
    });
    const lonelyFeed = await api("GET", "/api/slot/status", { token: lonely.token });
    check("an empty campus returns an empty feed, not an error", lonelyFeed.status === 200 &&
      lonelyFeed.data.people.length === 0);

    const incomplete = await api("POST", "/api/auth/register", {
      body: { name: "Half Done", email: "half@test.edu", password: "password123", college: "niit university" },
    });
    const blocked = await api("POST", "/api/match/like", {
      token: incomplete.data.token,
      body: { targetUserId: users[0].id },
    });
    check("incomplete profiles cannot like", blocked.status === 428, String(blocked.status));
  } catch (err) {
    failed++;
    failures.push(`fatal: ${err.stack || err.message}`);
    console.error("\nFATAL:", err);
  } finally {
    section("Result");
    console.log(`  ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}`);
    if (failures.length) {
      console.log("\nFailures:");
      failures.forEach((f) => console.log(`  • ${f}`));
    }
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(failed === 0 ? 0 : 1);
  }
};

run();
