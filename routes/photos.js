const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  createPhoto,
  getPhotoById,
  listPhotos,
  getPhotosByCreator,
  updatePhoto,
} = require("../services/cosmosService");
const { uploadBlob, deleteBlob } = require("../services/blobService");
const { analyseImage } = require("../services/visionService");

const router = express.Router();

// Multer: store uploads in memory (max 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// ─── GET /api/photos ──────────────────────────────────────────────────────────
// Public: list all photos, optional ?q=search&limit=N&offset=N
router.get("/", async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const photos = await listPhotos(q, parseInt(limit), parseInt(offset));
    res.json(photos);
  } catch (err) {
    console.error("[PHOTOS] List error:", err.message);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// ─── GET /api/photos/my ───────────────────────────────────────────────────────
// Creator only: get their own uploads
router.get("/my", authenticate, requireRole("creator"), async (req, res) => {
  try {
    const photos = await getPhotosByCreator(req.user.id);
    res.json(photos);
  } catch (err) {
    console.error("[PHOTOS] My photos error:", err.message);
    res.status(500).json({ error: "Failed to fetch your photos" });
  }
});

// ─── GET /api/photos/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const photo = await getPhotoById(req.params.id);
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    res.json(photo);
  } catch (err) {
    console.error("[PHOTOS] Get error:", err.message);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

// ─── POST /api/photos ─────────────────────────────────────────────────────────
// Creator only: upload a photo with metadata
router.post(
  "/",
  authenticate,
  requireRole("creator"),
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const { title, caption, location, peopleTagged } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      // Upload to Blob Storage
      const blobUrl = await uploadBlob(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        process.env.STORAGE_CONTAINER_PHOTOS
      );

      // AI Vision analysis (runs after blob upload so we have a URL)
      const { tags, caption: aiCaption } = await analyseImage(blobUrl);

      // Parse peopleTagged (sent as JSON string or comma-separated)
      let people = [];
      if (peopleTagged) {
        try {
          people = JSON.parse(peopleTagged);
        } catch {
          people = peopleTagged.split(",").map((p) => p.trim()).filter(Boolean);
        }
      }

      const photo = {
        id: uuidv4(),
        creatorId: req.user.id,
        creatorName: req.user.displayName,
        title,
        caption: caption || "",
        location: location || "",
        peopleTagged: people,
        blobUrl,
        tags,
        aiCaption,
        averageRating: 0,
        ratingCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };

      const saved = await createPhoto(photo);
      res.status(201).json(saved);
    } catch (err) {
      console.error("[PHOTOS] Upload error:", err.message);
      res.status(500).json({ error: "Upload failed: " + err.message });
    }
  }
);

// ─── PUT /api/photos/:id ──────────────────────────────────────────────────────
// Creator only: update metadata (not the image itself)
router.put("/:id", authenticate, requireRole("creator"), async (req, res) => {
  try {
    const photo = await getPhotoById(req.params.id);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    if (photo.creatorId !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own photos" });
    }

    const { title, caption, location, peopleTagged } = req.body;

    if (title) photo.title = title;
    if (caption !== undefined) photo.caption = caption;
    if (location !== undefined) photo.location = location;
    if (peopleTagged !== undefined) {
      try {
        photo.peopleTagged = JSON.parse(peopleTagged);
      } catch {
        photo.peopleTagged = peopleTagged.split(",").map((p) => p.trim()).filter(Boolean);
      }
    }

    const updated = await updatePhoto(photo);
    res.json(updated);
  } catch (err) {
    console.error("[PHOTOS] Update error:", err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

module.exports = router;
