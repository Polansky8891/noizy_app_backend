require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { dbConnection } = require('./database/config');
const { validateJWT } = require('./middlewares/validate-jwt');

const tracksRouter = require('./routes/tracks');
const authRouter = require('./routes/auth');
const favoritesRouter = () => require('./routes/favorites');
const statsRouter = () => require('./routes/stats');

const app = express();

app.use(cors({
  origin: [process.env.WEB_ORIGIN || 'http://localhost:5173'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-token'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: false,
}));

app.use(express.static('public'));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/tracks', tracksRouter);
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/me/favorites', validateJWT, favoritesRouter());
}
app.use('/api/stats', validateJWT, statsRouter());

module.exports = { app };

// 🔧 Arranque con conexión garantizada
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await dbConnection();               // ⬅️ ¡CONÉCTATE!
      const PORT = process.env.PORT || 4000;
      app.listen(PORT, () => console.log(`API escuchando en ${PORT}`));
    } catch (err) {
      console.error('Error conectando a MongoDB:', err);
      process.exit(1);
    }
  })();
}
