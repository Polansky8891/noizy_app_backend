// controllers/auth.js
const { response } = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User.js'); // ⚠️ con extensión .js
const { generateJWT } = require('../helpers/jwt');
const crypto = require('crypto');
const admin = require('../firebase/admin.js');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const createUser = async (req, res = response) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        ok: false,
        msg: 'a user already exists with this email',
      });
    }

    user = new User(req.body);

    const salt = bcrypt.genSaltSync();
    user.password = bcrypt.hashSync(password, salt);

    await user.save();

    const token = await generateJWT(user.id, user.name);

    res.status(201).json({
      ok: true,
      uid: user.id,
      name: user.name,
      token,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      msg: 'Please talk to the administrator',
    });
  }
};

const loginUser = async (req, res = response) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        ok: false,
        msg: 'user doesnt exist',
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({
        ok: false,
        msg: 'invalid password',
      });
    }

    const token = await generateJWT(user.id, user.name);

    res.json({
      ok: true,
      uid: user.id,
      name: user.name,
      token,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      msg: 'Please talk to the administrator',
    });
  }
};

const renewToken = async (req, res = response) => {
  const { uid, name } = req;
  const token = await generateJWT(uid, name);
  res.json({ ok: true, token });
};

const googleSignIn = async (req, res = response) => {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ ok: false, msg: 'idToken is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleUid = payload.sub;
    const email = payload.email;
    const name = payload.name || '';
    const picture = payload.picture || '';

    if (!email) {
      return res.status(400).json({ ok: false, msg: 'Google token without email' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      const randomPwd = crypto.randomBytes(16).toString('hex');
      const salt = bcrypt.genSaltSync();
      const hash = bcrypt.hashSync(randomPwd, salt);

      user = new User({
        email,
        name,
        password: hash,
        photo: picture || null,
        provider: 'google',
        googleUid,
      });
      await user.save();
    } else {
      let dirty = false;
      if (!user.name && name) { user.name = name; dirty = true; }
      if (!user.photo && picture) { user.photo = picture; dirty = true; }
      if (!user.googleUid) { user.googleUid = googleUid; dirty = true; }
      if (dirty) await user.save();
    }

    const token = await generateJWT(user.id, user.name);
    return res.json({
      ok: true,
      uid: user.id,
      name: user.name,
      email: user.email,
      photoURL: user.photo || null,
      token,
    });
  } catch (e) {
    console.error('[auth/google] verify error:', e?.message || e);
    return res.status(400).json({ ok: false, msg: 'Invalid Google token' });
  }
};

module.exports = {
  createUser,
  loginUser,
  renewToken,
  googleSignIn,
};
