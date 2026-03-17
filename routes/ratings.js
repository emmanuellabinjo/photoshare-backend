const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { authenticate } = require("../middleware/auth");
const {
  createOrUpdateRating,
  getRatingsByPhoto,
  getUserRatingForPhoto,
  getPhotoById,
  updatePhoto,
} = require("../services/cosmosService");

const router = express.Router();

// ─── GET /api/ratings/:photoId ────────────────────────────────────────────────
router.get("/:photoId", async (req, res) => {
  try {
    const ratings = await getRatingsByPhoto(req.params.photoId);
    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;
    res.json({ ratings, average: Math.round(avg * 10) / 10, count: ratings.length });
  } catch (err) {
    console.error("[RATINGS] Get error:", err.message);
    res.status(500).json({ error: "Failed to fetch ratings" });
  }
});

// ─── POST /api/ratings/:photoId ───────────────────────────────────────────────
// Authenticated: any user can rate. One rating per user per photo (upsert).
router.post("/:photoId", authenticate, async (req, res) => {
  try {
    const score = parseInt(req.body.score);
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: "score must be an integer between 1 and 5" });
    }

    const photo = await getPhotoById(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    // Check if user already rated this photo
    const existing = await getUserRatingForPhoto(req.params.photoId, req.user.id);

    const rating = {
      id: existing?.id || uuidv4(),
      photoId: req.params.photoId,
      userId: req.user.id,
      score,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await createOrUpdateRating(rating);

    // Recalculate average from all ratings
    const allRatings = await getRatingsByPhoto(req.params.photoId);
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

    // Update denormalised fields on the photo document
    photo.averageRating = Math.round(avg * 10) / 10;
    photo.ratingCount = allRatings.length;
    await updatePhoto(photo);

    res.status(201).json({
      rating: saved,
      average: photo.averageRating,
      count: photo.ratingCount,
    });
  } catch (err) {
    console.error("[RATINGS] Post error:", err.message);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

module.exports = router;
