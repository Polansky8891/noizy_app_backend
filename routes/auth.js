/*
    Rutas de auth
    host + /api/auth
*/

const { Router } = require('express');
const { check } = require('express-validator');
const router = Router();

const { createUser, loginUser, renewToken } = require('../controllers/auth');
const { fieldsValidator } = require('../middlewares/fields-validators');
const { validateJWT } = require('../middlewares/validate-jwt');


router.post(
    '/new',
    [ // middlewares
        check('name', 'name is mandatory').not().isEmpty(),
        check('email', 'email is mandatory').isEmail(),
        check('password', 'password must contain at least 6 characters').isLength({ min:6 }),
        fieldsValidator
    ],
    createUser);

router.post(
    '/',
    [ // middlewares
        check('email', 'email is mandatory').isEmail(),
        check('password', 'password must contain at least 6 characters').isLength({ min:6 }),
        fieldsValidator
    ],
    loginUser);

router.get('/renew', validateJWT, renewToken);


module.exports = router;

