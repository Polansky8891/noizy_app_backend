const { Router } = require('express');
const { check } = require('express-validator');

// 🛑 AÑADIR: Importar el middleware de validación para detener el 400
const { fieldsValidator } = require('../middlewares/fields-validators'); 

// Importamos el middleware de autenticación (Necesario para proteger rutas)
const { validateJWT } = require('../middlewares/validate-jwt'); 

const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favorites');


const router = Router();

// NOTA: ELIMINAMOS router.use(validateJWT) porque ya está en index.js

router.get('/', validateJWT, getFavorites); // ✅ Proteger GET

router.post(
    '/', 
    [ 
        check('trackId','El trackId es obligatorio').not().isEmpty(),
        fieldsValidator // 🛑 APLICACIÓN CLAVE: Atrapa el error 400
    ], 
    validateJWT, // ✅ Proteger POST
    addFavorite
);

router.delete('/:trackId', validateJWT, removeFavorite); // ✅ Proteger DELETE

module.exports = router;