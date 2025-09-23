require('dotenv').config();

const express = require('express');
const { dbConnection } = require('./database/config');
const cors = require('cors');
const { validateJWT } = require('./middlewares/validate-jwt');

const tracksRouter = require('./routes/tracks');
const favoritesRouter = require('./routes/favorites');
const statsRouter = require('./routes/stats');
const authRouter = require('./routes/auth');
const debugRouter = require('./routes/debug');

const app = express();

dbConnection();

app.use(cors({
  origin: [process.env.WEB_ORIGIN || 'http://localhost:5173'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-token'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: false,
}));

app.use( express.static('public'));
app.use( express.json() );

app.use('/api/auth', authRouter);
app.use('/api/tracks', tracksRouter);

app.use('/api/me/favorites', validateJWT, favoritesRouter);
app.use('/api/stats', validateJWT, statsRouter);
app.use('/api/debug', validateJWT, debugRouter);

app.use('/api/debug', require('./routes/debug'));


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en ${PORT}`);
});



