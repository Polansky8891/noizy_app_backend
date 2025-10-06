// scripts/warm-thumbs.js
const mongoose = require('mongoose');
const axios = require('axios');
const Track = require('../models/Track');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_CNN);

// construye la URL 48x48 EXACTA que pide el front
const clThumb48 = (url) =>
  url && url.includes('/upload/')
    ? url.replace('/upload/', '/upload/c_fill,w_48,h_48,f_auto,q_auto:low,dpr_1,e_sharpen:40/')
    : null;

(async () => {
  try {
    const tracks = await Track.find({}, { coverUrl: 1, title: 1 }).lean();
    console.log(`Encontradas ${tracks.length} portadas. Generando miniaturas 48×48...`);

    for (const t of tracks) {
      const thumb = clThumb48(t.coverUrl);
      if (!thumb) continue;
      try {
        await axios.get(thumb, { timeout: 8000 });
        console.log('WARMED:', t.title);
      } catch (e) {
        console.warn('SKIP:', t.title, '-', e.message);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
})();
