// Dentro de routes/auth.js

const { Router } = require('express');
const { check } = require('express-validator');
const { fieldsValidator } = require('../middlewares/fields-validators');
const { validateJWT } = require('../middlewares/validate-jwt');

const router = Router();

// FUNCIÓN DE CARGA DIFERIDA (JIT) para evitar errores de Jest/Hoisting
const getController = () => {
    return require('../controllers/auth');
};


router.post(
    '/new',
    [ // middlewares
        check('name', 'name is mandatory').not().isEmpty(),
        check('email', 'email is mandatory').isEmail(),
        check('password', 'password must contain at least 6 characters').isLength({ min:6 }),
        fieldsValidator
    ],
    // Usamos el controlador cargado justo a tiempo (JIT)
    (req, res, next) => getController().createUser(req, res, next)
);

router.post(
    '/',
    [ // middlewares
        check('email', 'email is mandatory').isEmail(),
        check('password', 'password must contain at least 6 characters').isLength({ min:6 }),
        fieldsValidator
    ],
    // Usamos el controlador cargado justo a tiempo (JIT)
    (req, res, next) => getController().loginUser(req, res, next)
);

// CORRECCIÓN CLAVE: Aplicamos JIT a la ruta que FALLA
router.get(
    '/renew', 
    validateJWT, 
    (req, res, next) => getController().renewToken(req, res, next)
);

router.post(
    '/google', 
    (req, res, next) => getController().googleSignIn(req, res, next)
);


module.exports = router;