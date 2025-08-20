const { Router } = require('express');
const { check } = require('express-validator');
const { validateJWT } = require('../middlewares/validate-jwt');
const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favorites');

const router = Router();

router.use(validateJWT);

router.get('/', getFavorites);

router.post('/', [
    check('trackId', 'El trackId es obligatorio').not().isEmpty()
], addFavorite);

router.delete('/:trackId', removeFavorite);

module.exports = router;

