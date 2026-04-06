const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const preferenceRoutes = require("./routes/preferenceRoutes");
const matchRoutes = require("./routes/matchRoutes");
const communityRoutes = require("./routes/communityRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const slotRoutes = require("./routes/slotRoutes"); // 🔥 NEW: Slot-based state API
const path = require("path");
const { runAutoCleanup } = require("./utils/cleanup");

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173", "https://messmatefinal.vercel.app"];
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/slot", slotRoutes); // 🔥 NEW: Unified slot status endpoint

// Expose uploads directory statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to MessMate API 🍽️" });
  
});

// Debug (optional)
console.log("Environment:", process.env.NODE_ENV);

// Start server
const PORT = process.env.PORT || 5000;

// 🔥 Run background cleanup every 5 minutes
setInterval(runAutoCleanup, 5 * 60 * 1000);
runAutoCleanup(); // Run once at starts

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});