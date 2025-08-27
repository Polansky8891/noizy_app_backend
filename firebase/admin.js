const admin = require('firebase-admin');

if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(svc),
        });
        console.log('[firebase-admin] initialized with service account');
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
        console.log('[firebase-admin] initialized with applicationDefault()');
    }
}

module.exports = admin;