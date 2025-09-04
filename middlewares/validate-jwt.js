// middlewares/validate-jwt.js
const { response } = require('express');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const admin = require('../firebase/admin');
const User = require('../models/User');

const validateJWT = async (req, res = response, next) => {
  let token = req.get('authorization') || req.get('x-token');
  if (!token) return res.status(401).json({ ok:false, msg:'missing token' });
  if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim();

  // 1) Tu JWT
  try {
    const p = jwt.verify(token, process.env.SECRET_JWT_SEED);
    const rawId = p.userId || p.id || p.uid;
    if (rawId && Types.ObjectId.isValid(rawId)) {
      req.userId = Types.ObjectId.createFromHexString(rawId);
      req.uid = rawId;
      req.name = p.name || '';
      return next();
    }
    // si no hay ObjectId válido, seguimos a Firebase
  } catch (_) {}

  // 2) Firebase
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) return res.status(401).json({ ok:false, msg:'user not found for firebase uid' });

    req.userId = user._id;
    req.uid = user._id.toString();
    req.name = user.name || decoded.name || '';
    return next();
  } catch (_) {
    return res.status(401).json({ ok:false, msg:'invalid token' });
  }
};

module.exports = { validateJWT };
