// controllers/stats.controller.js
const mongoose = require('mongoose');
const { Types } = require('mongoose');
const ListeningTick = require('../models/ListeningTick');
const PlayEvent = require('../models/PlayEvent');
const Track = require('../models/Track'); // para lookup/fallback

exports.summary = async (req, res) => {
  try {
    const uid = String(req.uid || '');                    // <-- ANTES: podías leer userId
    if (!uid) return res.status(401).json({ error: 'unauthorized' });

    const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
    const from = new Date(Date.now() - days * 86400000);

    // 🔴 IMPORTANTE: usa el string de uid tal cual
    const userId = uid;

    // Minutos por día
    const daily = await ListeningTick.aggregate([
      { $match: { userId, at: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, ms: { $sum: '$ms' } } },
      { $sort: { _id: 1 } },
    ]);

    const totalMs = daily.reduce((a, d) => a + (d.ms || 0), 0);

    // Plays y pistas únicas
    const playsAgg = await PlayEvent.aggregate([
      { $match: { userId, at: { $gte: from } } },
      { $group: { _id: null, plays: { $sum: 1 }, uniq: { $addToSet: '$trackId' } } },
      { $project: { _id: 0, plays: 1, uniqueTracks: { $size: '$uniq' } } }
    ]);
    const plays = playsAgg[0]?.plays || 0;
    const uniqueTracks = playsAgg[0]?.uniqueTracks || 0;

    // Top géneros (fallback al del Track)
    const topGenres = await ListeningTick.aggregate([
      { $match: { userId, at: { $gte: from } } },
      { $lookup: { from: Track.collection.name, localField: 'trackId', foreignField: '_id', as: 't' } },
      { $unwind: { path: '$t', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          g0: {
            $cond: [
              {
                $or: [
                  { $eq: [{ $type: '$genre' }, 'missing'] },
                  { $eq: [{ $toLower: { $trim: { input: '$genre' } } }, 'unknown'] },
                  { $eq: [{ $toLower: { $trim: { input: '$genre' } } }, ''] }
                ]
              },
              '$t.genre',
              '$genre'
            ]
          }
        }
      },
      { $addFields: { g: { $cond: [{ $ne: ['$g0', null] }, { $toLower: { $trim: { input: '$g0' } } }, null] } } },
      { $match: { g: { $ne: null, $ne: '' } } },
      { $group: { _id: '$g', ms: { $sum: '$ms' } } },
      { $sort: { ms: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          genre: { $concat: [{ $toUpper: { $substrCP: ['$_id', 0, 1] } }, { $substrCP: ['$_id', 1, { $strLenCP: '$_id' }] }] },
          ms: 1
        }
      }
    ]);

    // Si no hay datos, devuelve 204 (opcional)
    // if (!daily.length && !plays && !uniqueTracks) return res.sendStatus(204);

    return res.json({
      days,
      minutes: Math.round(totalMs / 60000),
      plays,
      uniqueTracks,
      topGenres,
      daily: daily.map(d => ({ date: d._id, ms: d.ms })),
    });
  } catch (e) {
    console.error('[stats.summary] error:', e);
    return res.status(500).json({ ok: false, msg: 'Stats summary failed' });
  }
};

// ── POST /api/stats/tick ──────────────────────────────────────────────────────
exports.tick = async (req, res) => {
  try {
    const uid = String(req.uid || '');                    // <-- ANTES: req.userId
    if (!uid) return res.status(401).json({ error: 'unauthorized' });

    const { ticks = [] } = req.body || {};
    if (!Array.isArray(ticks) || !ticks.length) {
      return res.status(400).json({ error: 'empty ticks' });
    }

    const userId = uid;                                   // 🔴 usa string

    const filtered = ticks.filter(
      (t) =>
        mongoose.isValidObjectId(t.trackId) &&
        Number(t.ms) >= 5000 &&
        Number(t.ms) <= 60000
    );
    if (!filtered.length) return res.status(400).json({ error: 'invalid ticks' });

    // fallback de genre desde Track si falta
    const missingIds = [...new Set(filtered.filter((t) => !t.genre).map((t) => String(t.trackId)))];
    let genreByTrackId = {};
    if (missingIds.length) {
      const rows = await Track.find({ _id: { $in: missingIds } }, { _id: 1, genre: 1 }).lean();
      genreByTrackId = Object.fromEntries(rows.map((r) => [String(r._id), r.genre || null]));
    }

    const docs = filtered.map((t) => ({
      userId,                                                 // <-- string
      trackId: new mongoose.Types.ObjectId(t.trackId),
      genre: (t.genre ?? genreByTrackId[String(t.trackId)] ?? null),
      ms: Math.round(Number(t.ms) || 0),
      at: t.at ? new Date(t.at) : new Date(),
    }));

    await ListeningTick.insertMany(docs, { ordered: false });
    return res.json({ ok: true, saved: docs.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};