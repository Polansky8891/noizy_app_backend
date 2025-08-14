const express = require('express');
const Track = require('../models/Track');
const router = express.Router();

const ALLOWED_FIELDS = [
    "title",
    "artist",
    "duration",
    "genre",
    "coverUrl",
    "audioUrl"
];

// helpers
const toProjection = (fields) => {
    if(!fields) return "title artist duration genre coverUrl audioUrl";
    return fields
        .split(",")
        .map((f) => f.trim())
        .filter((f) => ALLOWED_FIELDS.includes(f))
        .join("") || "title artist duration genre coverUrl audioUrl";
};



router.get('/', async (req, res) => {
    try {
        const { genre, fields } = req.query;
        const query = {};
        if (genre) query.genre = genre;
        const projection = toProjection(fields);

        const items = await Track.find(query).select(projection).lean();
        res.json({ items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "error fetching tracks"});
    }
});

module.exports = router;