const { response } = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateJWT } = require('../helpers/jwt');
const crypto = require('crypto');
const admin = require('../firebase/admin');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);


const createUser = async(req, res = response) => {

   const { email, password } = req.body;

   try {
    let user = await User.findOne({ email });

    if ( user ) {
        return res.status(400).json({
            ok: false,
            msg: 'a user already exists with this email'
        });
    }

     user = new User( req.body );

     // password crypt
     const salt = bcrypt.genSaltSync();
     user.password = bcrypt.hashSync( password, salt );


     await user.save();

     // generate JWT
    const token = await generateJWT( user.id, user.name );

    res.status(201).json({
        ok: true,
        uid: user.id,
        name: user.name,
        token
    })
    
   } catch (error) {
        res.status(500).json({
            ok: false,
            msg: 'Please talk to the administrator'
        });
   }

}

const loginUser = async(req, res = response) => {

    const { email, password } = req.body;

    try {

    let user = await User.findOne({ email });

    if ( !user ) {
        return res.status(400).json({
            ok: false,
            msg: 'user doesnt exist'        
        });
    }

    // confirm password
    const validPassword = bcrypt.compareSync( password, user.password );

    if ( !validPassword ) {
        return res.status(400).json({
            ok: false,
            msg: 'invalid password'
        });
    }

    // generate JWT
    const token = await generateJWT( user.id, user.name );

    res.json({
        ok: true,
        uid: user.id,
        name: user.name,
        token
    })

        
    } catch (error) {

        res.status(500).json({
            ok: false,
            msg: 'Please talk to the administrator'
        });
        
    }


}

const renewToken = async(req, res = response) => {

    const { uid, name } = req;

    // generate JWT
    const token = await generateJWT( uid, name );


    res.json({
        ok:true,
        token
    })
    
}

const googleSignIn = async (req, res = response) => {
    try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ ok: false, msg: 'idToken is required' });
    }

    // DEBUG: mira qué aud trae el token que llega
    const parts = idToken.split('.');
    const payloadRaw = Buffer.from(parts[1], 'base64').toString();
    const incoming = JSON.parse(payloadRaw);
    console.log('[auth/google] incoming aud:', incoming.aud, 'iss:', incoming.iss);
    console.log('[auth/google] BACKEND GOOGLE_WEB_CLIENT_ID:', process.env.GOOGLE_WEB_CLIENT_ID);

    // Verifica contra TU Web client ID (el del incoming.aud que viste en el front)
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID, // <- DEBE coincidir
    });

    const payload = ticket.getPayload(); // sub, email, name, picture
    const googleUid = payload.sub;
    const email = payload.email;
    const name = payload.name || '';
    const picture = payload.picture || '';

    if (!email) return res.status(400).json({ ok: false, msg: 'Google token without email' });

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
}