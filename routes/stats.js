const { Router } = require('express');
const PlayEvent = require('../models/PlayEvent');
const ListeningTick = require('../models/ListeningTick');
const mongoose = require('mongoose');
const { validateJWT } = require('../middlewares/validate-jwt');
const { summary, tick } = require('../controllers/stats');

const router = Router();

const normalizeGenre = (g) => {
if (!g) return null;
const s = String(g).trim().toLowerCase();
if (['hiphop','hip-hop','hip hop'].includes(s)) return 'Hip-Hop';
if (s === 'classic') return 'Classical';
return s ? s[0].toUpperCase() + s.slice(1) : null;
};

router.post('/play', validateJWT, async (req, res) => {
  try {
    const uid = String(req.uid || '');
    if (!uid) return res.status(401).json({ ok:false, code:'unauthorized', msg:'no user' });

    const { trackId, genre } = req.body || {};
    if (!mongoose.isValidObjectId(trackId)) {
      return res.status(400).json({ ok:false, code:'invalid-arg', msg:'invalid trackId' });
    }

    await PlayEvent.create({
      userId: uid,
      trackId: new mongoose.Types.ObjectId(trackId),
      genre: normalizeGenre(genre) || null,
      at: new Date(),
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok:false, code:'server-error', msg: error.message });
  }
});

// --- TICK & SUMMARY --- (controladores reales)
router.post('/tick', tick);
router.get('/summary', summary);

// --- RECENT ---
router.get('/recent', async (req, res) => {
  try {
    const uid = String(req.uid || '');
    if (!uid) return res.status(401).json({ ok:false, code:'unauthorized', msg:'no user' });

    const items = await PlayEvent.find({ userId: uid })
      .sort({ at: -1 })
      .limit(20)
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({ ok:false, code:'server-error', msg: error.message });
  }
});

module.exports = router;