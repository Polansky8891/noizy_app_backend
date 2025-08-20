const User = require('../models/User');

const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.uid).populate('favorites');
        res.json(user.favorites);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener favoritos'});
    }
};

const addFavorite = async (req, res) => {
    const { trackId } = req.body;
    try {
        await User.findByIdAndUpdate(req.uid, {$addToSet: { favorites: trackId}});
        res.json({ msg: 'Añadido a favoritos'});
    } catch (error) {
        res.status(500).json({ msg: 'Error al añadir favorito'});
    }
};

const removeFavorite = async (req, res) => {
    const { trackId } = req.params;
    try {
        await User.findByIdAndUpdate(req.uid, {$pull: {favorites: trackId}});
        res.json({ msg: 'Eliminado de favoritos'});
    } catch (error) {
        res.status(500).json({ msg: 'Error al eliminar favorito'})
        
    }
};

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
}