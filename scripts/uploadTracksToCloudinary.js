// scripts/upload-from-json.js
const mongoose = require('mongoose');
const Track = require('../models/Track');
const cloudinary = require('../utils/cloudinary'); // ya config
const path = require('path');              // 👈 IMPORTANTE
const fs = require('fs');                  // 👈 IMPORTANTE
require('dotenv').config();

mongoose.connect(process.env.DB_CNN);

// Raíz del proyecto (sube desde /scripts a /)
const ASSETS_BASE = path.resolve(__dirname, '..');

// Quita ./ y ../ y resuelve desde la raíz del proyecto
const resolveAsset = (p) => {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  return path.resolve(ASSETS_BASE, p.replace(/^(\.\/|\.{2}\/)+/, ''));
};

// Tu JSON
const tracks = require('../tracks.json'); // ajusta ruta si hace falta

(async () => {
  try {
    for (const [i, t] of tracks.entries()) {
      try {
        const { title, artist, genre, duration, audioPath, coverPath } = t;

        const audioAbs = resolveAsset(audioPath);
        const coverAbs = resolveAsset(coverPath);

        if (!fs.existsSync(audioAbs) || !fs.existsSync(coverAbs)) {
          console.warn(`⚠️ Saltando "${title}" (no encuentro audio o cover)`);
          continue;
        }

        // pequeño respiro para Cloudinary
        await new Promise(r => setTimeout(r, 300));

        const audioUpload = await cloudinary.uploader.upload(audioAbs, {
          resource_type: 'auto', // mp3 -> auto o video
          folder: 'noizzy/audio',
        });

        const coverUpload = await cloudinary.uploader.upload(coverAbs, {
          folder: 'noizzy/covers',
        });

        await new Track({
          title,
          artist,
          genre,
          duration: Number(duration) || null,
          audioUrl: audioUpload.secure_url,
          coverUrl: coverUpload.secure_url,
        }).save();

        console.log(`✔️ [${i + 1}/${tracks.length}] "${title}" subido`);
      } catch (err) {
        const msg = err?.error?.message || err?.message || String(err);
        console.error(`❌ Error en fila ${i} ("${t?.title || 'sin título'}"): ${msg}`);
        continue;
      }
    }
  } finally {
    await mongoose.disconnect();
  }
})();
