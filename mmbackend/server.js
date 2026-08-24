const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

dotenv.config();

const connectDB = require("./config/db");
const { runAutoCleanup } = require("./utils/cleanup");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const preferenceRoutes = require("./routes/preferenceRoutes");
const matchRoutes = require("./routes/matchRoutes");
const communityRoutes = require("./routes/communityRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const slotRoutes = require("./routes/slotRoutes");
const chatRoutes = require("./routes/chatRoutes");

// ─── STARTUP CHECKS ─────────────────────────────────────────────────────────
// Fail loudly at boot rather than with a 500 on someone's first login.
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[boot] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 24) {
  console.warn("[boot] JWT_SECRET is short. Use a long random string in production.");
}

connectDB();

const app = express();
app.set("trust proxy", 1);

// ─── SECURITY & TRANSPORT ───────────────────────────────────────────────────
app.use(
  helmet({
    // The API serves JSON and (in local mode) images; it renders no HTML.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
  .filter(Boolean)
  .map((o) => o.replace(/\/$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl / server-to-server
      const clean = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(clean)) return callback(null, true);
      // Any Vercel preview deployment of this project.
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(clean)) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

/**
 * Strip Mongo operator keys from user input. Nothing in this API legitimately
 * accepts a key starting with `$` or containing a dot, and this closes off
 * query-injection through JSON bodies without pulling in a dependency.
 */
const sanitize = (obj, depth = 0) => {
  if (!obj || typeof obj !== "object" || depth > 6) return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) delete obj[key];
    else sanitize(obj[key], depth + 1);
  }
};
app.use((req, _res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// ─── ROUTES ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/slot", slotRoutes);
app.use("/api/chat", chatRoutes);

// Local-disk uploads (only used when Cloudinary isn't configured).
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), { maxAge: "7d", fallthrough: true })
);

app.get("/", (_req, res) => res.json({ name: "MessMate API", status: "ok" }));
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  })
);

// ─── ERRORS ─────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? "Something went wrong on our end." : err.message,
  });
});

// ─── BACKGROUND CLEANUP ─────────────────────────────────────────────────────
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => runAutoCleanup().catch((e) => console.error("[cleanup]", e)), CLEANUP_INTERVAL_MS);
runAutoCleanup().catch((e) => console.error("[cleanup]", e));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`MessMate API listening on ${PORT}`));

// Give in-flight requests a chance to finish on redeploy.
const shutdown = (signal) => () => {
  console.log(`[shutdown] ${signal}`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));

module.exports = app;
