const mongoose = require('mongoose');

async function dbConnection() {
  const uri = process.env.DB_CNN || process.env.MONGODB_CNN || process.env.MONGO_URI || process.env.MONGODB_URI || '';
  if (!uri) {
    console.error('[DB] ❌ Falta la URI (DB_CNN / MONGODB_CNN / MONGO_URI)');
    throw new Error('DB_URI_MISSING');
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: process.env.NODE_ENV !== 'production',
    });
    console.log('[DB] ✅ Conectado a MongoDB');
  } catch (err) {
    console.error('[DB] ❌ Error conectando a MongoDB:', err?.name, err?.message);
    // Propaga el error REAL (no uno genérico)
    throw err;
  }
}

module.exports = {
    dbConnection
}