const { Router } = require('express');
const PlayEevnt = require('../models/PlayEvent');
const ListeningTick = require('../models/ListeningTick');

const router = Router();


router.post('/play', async (req, res) => {
    try {
        const { trackId, genre } = req.body;
        if (!trackId) return res.status(400).json({ error: 'trackId required'} );
        await PlayEevnt.create({ userId: req.user.id, trackId, genre });
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: e.message }); 
    }
});

router.post('/trick', async (req, res) => {
    try {
        const { ticks } = req.body;
        if (!Array.isArray(ticks) || !ticks.length) return res.status(400).json({ error: 'empty ticks'});
        const docs = ticks
            .filter(t => t.trackId && t.ms >= 5000 && t.ms <= 60000)
            .map(t => ({
                userId: req.user.id,
                trackId: t.trackId,
                genre: t.genre,
                ms: Math.round(t.ms),
                at: t.at ? new Date(t.at) : new Date()
            }));
        if (!docs.length) return res.status(400).json({ error: 'invalid ticks'} );
        await ListeningTick.insertMany(docs, { ordered: false });
        res.json({ ok: true, saved: docs.length }); 
        
    } catch (error) { res.status(500).json({ error: e.message });
    }
});

router.get('/summary', async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days || '7', 10), 30);
        const tz = 'Europe/Madrid';
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const daily = await ListeningTick.aggregate([
            { $match: { userId: req.user.id, at: { $gte: since} } },
            { $group: {
                _id: { $dateToString: { date: '$at', format: '%Y-%m-%d', timezone: tz} },
                ms: { $sum: '$ms' }
            }},
            { $sort: { _id: 1} }
        ]);

        const topGenres = await ListeningTick.aggregate([
            { $match: { userId: req.user.id, at: { $gte: since } } },
            { $group: { _id: '$genre', ms: { $sum: '$ms'} } },
            { $sort: { ms: -1 } },
            { $limit: 5}
        ]);

        const playsAgg = await PlayEevnt.aggregate([
            { $match: { userId: req.user.id, at: { $gte: since} } },
            { $group: { _id: null, plays: { $sum: 1}, uniqueTracks: { $addToSet: '$trackId' } } },
            { $project: { _id: 0, plays: 1, uniqueTracks: { $size: '$uniqueTracks'} } }
        ]);

        const plays = playsAgg[0]?.plays || 0;
        const uniqueTracks = playsAgg[0]?.uniqueTracks || 0;

        const totalMs = daily.reduce((a, d) => a + d.ms, 0);

        res.json({
            days,
            totalMs,
            minuntes: Math.round(totalMs / 60000),
            plays,
            uniqueTracks,
            topGenres: topGenres.map(g => ({ genre: g._id|| 'Unknown', ms: g.ms })),
            daily: daily.map(d => ({ date: d._id, ms: d.ms }))
        });
    } catch (error) { res.status(500).json({ error: error.message });
    }
});

router.get('/recent', async (req, res) => {
    try {
        const items = await PlayEevnt.find({ userId: req.user.id })
            .sort({ at: -1}).limit(20).lean();
        res.json(items);
    } catch (error) { rs.status(500).json({ error: error.message});
    }
});

module.exports = router;



