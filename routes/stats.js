const { Router } = require('express');
const PlayEvent = require('../models/PlayEvent');
const ListeningTick = require('../models/ListeningTick');
const mongoose = require('mongoose');
const { validateJWT } = require('../middlewares/validate-jwt');

const router = Router();

router.post('/play', validateJWT, async (req, res) => { 
  try {
    const userId = req.userId;
    if(!userId) return res.status(401).json({ error: 'unauthorized' });

    const { trackId, genre } = req.body;
    if (!mongoose.isValidObjectId(trackId)) {
      return res.status(400).json({ error: 'invalid trackId'});
    }

    await PlayEvent.create({
      userId,
      trackId: new mongoose.Types.ObjectId(trackId),
      genre: genre || 'Unknown',
      at: new Date(),
    });

    res.json({ ok: true});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post('/tick', validateJWT, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized'});

    const { ticks } = req.body;
    if (!Array.isArray(ticks) || !ticks.length) {
      return res.status(400).json({ error: 'empty ticks' });
    }

    const docs = ticks
      .filter(t => mongoose.isValidObjectId(t.trackId) && t.ms >= 5000 && t.ms <= 60000)
      .map(t => ({
        userId,
        trackId: new mongoose.Types.ObjectId(t.trackId),
        genre: t.genre || 'Unknown',
        ms: Math.round(t.ms),
        at: t.at ? new Date(t.at) : new Date(),
      }));

      if (!docs.length) return res.status(400).json({ error: 'invalid ticks'});

      await ListeningTick.insertMany(docs, { ordered: false });
      res.json({ ok: true, saved: docs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', validateJWT, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const days = Math.min(parseInt(req.query.days || '7', 10), 30);
    const tz = 'Europe/Madrid';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const daily = await ListeningTick.aggregate([
      { $match: { userId, at: {$gte: since} } },
      { $group: {
          _id: { $dateToString: { date: '$at', format: '%Y-%m-%d', timezone: tz}},
          ms: { $sum: '$ms'}
      }},
      { $sort: { _id: 1}},
    ]);

    const topGenres = await ListeningTick.aggregate([
      { $match: { userId, at: { $gte: since } } },
      { $group: { _id: { $ifNull: ['$genre', 'Unknown']}, ms: {$sum: '$ms'}}},
      { $sort: { ms: -1}},
      { $limit: 5},
    ]);

    const playsAgg = await PlayEvent.aggregate([
      { $match: {userId, at: {$gte: since} } },
      { $group: { _id: null, plays: {$sum:1}, uniqueTracksSet: {$addToSet: '$trackId'}}},
      { $project: { _id: 0, plays: 1, uniqueTracks: { $size: '$uniqueTracksSet'}}},
    ]);

    const plays = playsAgg[0]?.plays || 0;
    const uniqueTracks = playsAgg[0]?.uniqueTracks || 0;
    const totalMs = daily.reduce((a, d) => a + (d.ms || 0), 0);

    if (plays === 0 && totalMs === 0) return res.status(204).send();

    res.json({
      days,
      minutes: Math.round(totalMs / 60000),
      plays,
      uniqueTracks,
      topGenres: topGenres.map(g => ({ genre: g._id, ms: g.ms})),
      daily: daily.map(d => ({ date: d._id, ms: d.ms})),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent', validateJWT, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized'});

    const items = await PlayEvent.find({ userId })
      .sort({ at: -1})
      .limit(20)
      .lean();

      res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message});
  }
});

module.exports = router;