const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Track = require('../models/Track');

const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.uid).populate('favorites');
        if (!user) return res.status(404).json({ ok: false, msg: 'User not found'});
        res.json(user.favorites || []);
    } catch (e) {
        console.error('[getFavorites] error:', e);
        res.status(500).json({ ok:false, msg: 'Server error'});
    }
    
};

const addFavorite = async (req, res) => {
    try {
        const { trackId } = req.body;
        console.log('[addFavorite]', { uid: req.uid, trackId, body: req.body});

        if (!trackId) return res.status(400).json({ ok: false, msg: 'trackId is required'});
        if (!mongoose.Types.ObjectId.isValid(trackId)) {
            return res.status(400).json({ ok: false, msg: 'Invalid trackId'});
        }

        const track = await Track.findById(trackId).select('_id');
        if (!track) return res.status(404).json({ ok: false, msg: 'Track not found'});

        const updated = await User.findByIdAndUpdate(
            req.uid,
            { $addToSet: { favorites: trackId } },
            { new: true }
        ).populate('favorites');

        res.status(200).json(updated.favorites || []);
    } catch (e) {
        console.error('[addFavorite] error:', e);
        res.status(500).json({ ok: false, msg: 'Server error' });
    }
};

const removeFavorite = async (req, res) => {
    try {
        const { trackId } = req.params;
        console.log('[removeFavorite]', { uid: req.uid, trackId });

        if (!mongoose.Types.ObjectId.isValid(trackId)) {
            return res.status(400).json({ ok:false, msg: 'Invalid trackId'});
        }

        const updated = await User.findByIdAndUpdate(
            req.uid,
            { $pull: { favorites: trackId }},
            { new: true }
        ).populate('favorites');

        res.status(200).json(updated.favorites || []);
    } catch (e) {
        console.error('[removeFavorite] error:', e);
        res.status(500).json({ ok: false, msg: 'Server error'});
    }
};

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
}