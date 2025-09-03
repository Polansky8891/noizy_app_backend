const jwt = require('jsonwebtoken');

const generateJWT = ( userId, name = '' ) => {

    return new Promise((resolve, reject) => {

        const payload = { 
            userId: userId.toString(),
            uid: userId.toString(),
            name
        };

        jwt.sign( payload, process.env.SECRET_JWT_SEED, {
            expiresIn: '72h'
        }, (err, token) => {

            if ( err ){
                console.error('[generateJWT] error:', err);
                reject('token not generated');
            }
            resolve( token );
        })
    })
}

module.exports = {
    generateJWT
}