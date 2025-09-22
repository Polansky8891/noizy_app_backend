// middlewares/validate-jwt.js
const { response } = require('express');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const admin = require('../firebase/admin');
const User = require('../models/User');

const mask = (t) => (t ? String(t).slice(0, 12) + '…' + String(t).slice(-8) : '∅');

const validateJWT = async (req, res = response, next) => {
  // 1) Header
  const rawHdr = req.get('authorization') || req.get('x-token');
  console.log(
    '[AUTH] header:',
    rawHdr
      ? (rawHdr.toLowerCase().startsWith('bearer ')
          ? 'Bearer ' + mask(rawHdr.slice(7).trim())
          : mask(rawHdr))
      : '∅'
  );

  let token = rawHdr;
  if (!token) {
    return res.status(401).json({ ok: false, code: 'no-token', msg: 'missing token' });
  }
  if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // 2) Intento con tu JWT local (si lo usas)
  try {
    const payload = jwt.verify(token, process.env.SECRET_JWT_SEED, { clockTolerance: 10 });
    const rawId = payload.userId || payload.id || payload.uid;
    if (rawId) {
      console.log('[AUTH] local JWT OK uid:', rawId);
      req.userId = rawId;               // string u ObjectId en texto; tus controllers ya lo manejan
      req.uid = rawId;
      req.name = payload.name || '';
      req.email = (payload.email || '').toLowerCase();
      req.auth = { provider: 'local', uid: req.uid };
      return next();
    }
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      console.warn('[AUTH] local JWT expired');
      return res.status(401).json({ ok: false, code: 'token-expired', msg: 'jwt expired' });
    }
    console.log('[AUTH] local JWT not valid → trying Firebase…');
  }

  // 3) Firebase ID token (sin tocar la BD)
  try {
    console.log('[AUTH] verifying Firebase token…', mask(token));
    // Puedes poner 'true' para forzar chequeo de revocación cuando todo esté estable
    const decoded = await admin.auth().verifyIdToken(token, false);
    console.log('[AUTH] Firebase OK uid:', decoded.uid);

    // 🚫 Nada de User.create ni consultas aquí
    req.userId  = decoded.uid;                          // <-- tus stats usan req.userId
    req.uid     = decoded.uid;
    req.email   = (decoded.email || '').toLowerCase();
    req.name    = decoded.name || (decoded.email ? decoded.email.split('@')[0] : '');
    req.auth    = { provider: 'firebase', uid: decoded.uid, email: req.email };

    return next();
  } catch (err) {
    const code =
      (err && (err.code || (err.errorInfo && err.errorInfo.code))) || 'unauthorized';
    const msg =
      (err && (err.message || (err.errorInfo && err.errorInfo.message))) || 'invalid token';
    console.error('[AUTH] Firebase verify error:', code, '-', msg);

    if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked') {
      return res.status(401).json({ ok: false, code, msg });
    }
    return res.status(401).json({ ok: false, code, msg });
  }
};

module.exports = { validateJWT };