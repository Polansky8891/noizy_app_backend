const admin = require('../firebase/admin');
const { response } = require('express');

const mask = (t) => (t ? String(t).slice(0, 12) + '…' + String(t).slice(-6) : '∅');

function base64urlToJson(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
}

async function validateJWT(req, res = response, next) {
  const raw = req.get('authorization') || req.get('x-token');
  console.log('[AUTH] header:', raw ? (raw.toLowerCase().startsWith('bearer ') ? 'Bearer ' + mask(raw.slice(7).trim()) : mask(raw.trim())) : '∅');

  if (!raw) {
    return res.status(401).json({ ok: false, code: 'no-token', msg: 'Falta token' });
  }

  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw.trim();

  try {
    const parts = token.split('.');
    const payload = base64urlToJson(parts[1]);
    console.log('[AUTH] token.aud=', payload.aud, 'token.iss=', payload.iss);
  } catch (e) {
    console.log('[AUTH] no pude decodificar payload:', e.message);
  }

  try {
    console.log('[ADMIN] projectId=', admin.app().options.projectId);
  } catch {}

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('[AUTH] OK uid=', decoded.uid);
    req.uid = decoded.uid;
    return next();
  } catch (err) {
    console.error('[AUTH] verifyIdToken error:', err.code || err.message);
    return res.status(401).json({ ok: false, code: err.code || 'invalid-token', msg: 'Token inválido o expirado' });
  }

}

module.exports = { validateJWT };