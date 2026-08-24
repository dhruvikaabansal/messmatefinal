/**
 * uploadRoutes.js — profile photos.
 *
 * Uploads go to Cloudinary when it is configured, and fall back to local disk
 * otherwise so development (and any deploy without credentials) keeps working.
 *
 * Why this matters: the old build always wrote to a local `uploads/` folder.
 * On Render/Railway/Fly that filesystem is ephemeral, so every redeploy silently
 * deleted every user's photo and profiles turned into initials overnight.
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const CLOUDINARY_ENABLED = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

let cloudinary = null;
if (CLOUDINARY_ENABLED) {
  // eslint-disable-next-line global-require
  cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log("[upload] Cloudinary storage enabled");
} else {
  console.warn(
    "[upload] Cloudinary not configured — falling back to local disk. " +
      "Photos will NOT survive a redeploy. Set CLOUDINARY_CLOUD_NAME, " +
      "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in production."
  );
}

const LOCAL_DIR = path.join(__dirname, "..", "uploads");
if (!CLOUDINARY_ENABLED && !fs.existsSync(LOCAL_DIR)) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Please upload a JPG, PNG or WebP image."));
  },
});

const uploadToCloudinary = (buffer, userId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "messmate/profiles",
        public_id: `user_${userId}`,
        overwrite: true,
        resource_type: "image",
        // Square, face-aware crop at a sane size — cards look consistent and
        // we stop shipping 6 MB phone photos to people on campus wifi.
        transformation: [
          { width: 800, height: 800, crop: "fill", gravity: "auto" },
          { quality: "auto:good", fetch_format: "auto" },
        ],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

router.post("/", protect, (req, res) => {
  upload.single("profilePic")(req, res, async (err) => {
    if (err) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        message: tooBig ? "That image is over 8 MB. Try a smaller one." : err.message,
      });
    }
    if (!req.file) return res.status(400).json({ message: "No image received." });

    try {
      if (CLOUDINARY_ENABLED) {
        const result = await uploadToCloudinary(req.file.buffer, req.user._id);
        return res.json({ imageUrl: result.secure_url, storage: "cloudinary" });
      }

      const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      fs.writeFileSync(path.join(LOCAL_DIR, safeName), req.file.buffer);
      return res.json({ imageUrl: `/uploads/${safeName}`, storage: "local" });
    } catch (e) {
      console.error("[upload]", e);
      return res.status(500).json({ message: "Upload failed. Try again." });
    }
  });
});

module.exports = router;
