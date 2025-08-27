const User = require('../models/User');
const { validationResult } = require('express-validator');

const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.uid).populate({
                path: 'favorites',
                select: 'title artist duration audioUrl coverUrl'
            });

            res.json(user?.favorites || []);
        } catch (err) {
            console.error('[getFavorites] error:', err);
            res.status(500).json({ msg: 'Error getting favorites'});
        }
    
};

const addFavorite = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { trackId } = req.body;
    try {
        await User.findByIdAndUpdate(req.uid, {$addToSet: { favorites: trackId}});
        res.status.json({ ok: true, trackId });
    } catch (error) {
        console.error('[addFavorite] error:', err);
        res.status(500).json({ msg: 'Error adding favorite'});
    }
};

const removeFavorite = async (req, res) => {
    const { trackId } = req.params;
    try {
        await User.findByIdAndUpdate(req.uid, {$pull: {favorites: trackId}});
        res.json({ ok: true, trackId });
    } catch (error) {
        console.error('[removeFavorite] error:', err);
        res.status(500).json({ msg: 'Error removing favorite' });
        
    }
};

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
}