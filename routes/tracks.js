// routes/tracks.js
const router = require('express').Router();
const Track = require('../models/Track');

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const parseDuration = (d) => {
  if (typeof d === "number" && Number.isFinite(d)) return d;
  if (typeof d === "string") {
    const m = d.match(/^(\d{1,2}):([0-5]\d)$/);
    if (m) return (+m[1]) * 60 + (+m[2]);
    const n = Number(d);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof d === "object" && d) {
    if ("seconds" in d) return Number(d.seconds) || 0;
    if ("length"  in d) return Number(d.length)  || 0;
  }
  return 0;
};

router.get('/', async (req, res) => {
  try {
    const { genre } = req.query;

    const query = {};
    if (genre) query.genre = new RegExp(`^${escapeRegex(genre)}$`, 'i');

    // SIN .select(): trae todo y normalizamos nosotros
    const docs = await Track.find(query).lean();

    const items = docs.map(d => ({
      _id: d._id,
      title:   d.title  ?? d.name   ?? d.Title   ?? d.song   ?? "",
      artist:  d.artist ?? d.author ?? d.Artist  ?? d.singer ?? "",
      duration: parseDuration(d.duration ?? d.length ?? d.Duration ?? d.time),
      genre:   d.genre  ?? d.Genre  ?? "",
      coverUrl: d.coverUrl ?? d.cover ?? "",
      audioUrl: d.audioUrl ?? d.url  ?? "",
    }));

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

module.exports = router;
