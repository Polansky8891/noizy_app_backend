// scripts/upload-from-json.js
const mongoose = require('mongoose');
const Track = require('../models/Track');
const cloudinary = require('../utils/cloudinary'); // ya config
const path = require('path');
const fs = require('fs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_CNN);

// Raíz del proyecto (sube desde /scripts a /)
const ASSETS_BASE = path.resolve(__dirname, '..');

// Quita ./ y ../ y resuelve desde la raíz del proyecto
const resolveAsset = (p) => {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  return path.resolve(ASSETS_BASE, p.replace(/^(\.\/|\.{2}\/)+/, ''));
};

// Transformación EAGER que coincide con el frontend (48x48, rápido)
const EAGER_THUMB = [
  {
    width: 48,
    height: 48,
    crop: 'fill',
    fetch_format: 'auto',
    quality: 'auto:low',
    dpr: '1',
    effect: 'sharpen:40',
  },
];

// Tu JSON
const tracks = require('../tracks.json'); // ajusta ruta si hace falta

(async () => {
  try {
    for (const [i, t] of tracks.entries()) {
      try {
        const { title, artist, genre, duration, audioPath, coverPath, feel } = t;

        const audioAbs = resolveAsset(audioPath);
        const coverAbs = resolveAsset(coverPath);

        if (!fs.existsSync(audioAbs) || !fs.existsSync(coverAbs)) {
          console.warn(`⚠️  Saltando "${title}" (no encuentro audio o cover)`);
          continue;
        }

        // pequeño respiro para Cloudinary
        await new Promise((r) => setTimeout(r, 300));

        // AUDIO
        const audioUpload = await cloudinary.uploader.upload(audioAbs, {
          resource_type: 'auto',          // mp3 -> ok con 'auto'
          folder: 'noizzy/audio',
          // opcional: use_filename: true, unique_filename: false, overwrite: true,
        });

        // COVER con EAGER (pre-generamos el thumb de 48x48 en la CDN)
        const coverUpload = await cloudinary.uploader.upload(coverAbs, {
          resource_type: 'image',
          folder: 'noizzy/covers',
          use_filename: true,             // URLs más estables (opcional)
          unique_filename: false,         // si nombres únicos controlados
          overwrite: true,                // re-subir mismo public_id si existe
          eager: EAGER_THUMB,             // 👈 pre-generación
          eager_async: false,             // espera a que se genere (bloquea pero deja todo listo)
          invalidate: false,
        });

        // (opcional) Si quieres guardar también la URL del eager para debug:
        // const coverThumb48 = coverUpload.eager?.[0]?.secure_url;

        await new Track({
          title,
          artist,
          genre,
          duration: Number(duration) || null,
          audioUrl: audioUpload.secure_url,
          coverUrl: coverUpload.secure_url,   // guardamos la original (frontend aplica la transformación)
          feel,
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
