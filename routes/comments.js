const express = require("express");
const { randomUUID: uuidv4 } = require("crypto");
const { authenticate } = require("../middleware/auth");
const {
  createComment,
  getCommentsByPhoto,
  getPhotoById,
  updatePhoto,
} = require("../services/cosmosService");

const router = express.Router();

// ─── GET /api/comments/:photoId ───────────────────────────────────────────────
router.get("/:photoId", async (req, res) => {
  try {
    const comments = await getCommentsByPhoto(req.params.photoId);
    res.json(comments);
  } catch (err) {
    console.error("[COMMENTS] Get error:", err.message);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// ─── POST /api/comments/:photoId ──────────────────────────────────────────────
router.post("/:photoId", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const photo = await getPhotoById(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    const comment = {
      id: uuidv4(),
      photoId: req.params.photoId,
      userId: req.user.id,
      displayName: req.user.displayName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const saved = await createComment(comment);

    // Increment commentCount on the photo document
    photo.commentCount = (photo.commentCount || 0) + 1;
    await updatePhoto(photo);

    res.status(201).json(saved);
  } catch (err) {
    console.error("[COMMENTS] Post error:", err.message);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

module.exports = router;
