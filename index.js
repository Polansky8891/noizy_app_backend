require('dotenv').config();
const express = require('express');
const { dbConnection } = require('./database/config');
const cors = require('cors');
const tracksRouter = require('./routes/tracks');
const favoritesRouter = require('./routes/favorites');
require('dotenv').config({ path: '.env.local' });


// Crear el servidor de express
const app = express();

//Database
dbConnection();

// CORS
app.use(cors())



// Directorio público
app.use( express.static('public'));


// Lectura y parseo del body
app.use( express.json() );



// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tracks', tracksRouter);
app.use('/api/me/favorites', require('./routes/favorites'));
app.use('/api/stats', require('./routes/stats'));




// Escuchar las petiicones
app.listen( process.env.PORT, () => {
    console.log(`Servidor corriendo en puerto ${ process.env.PORT }`);
})

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`API escuchando en ${process.env.PORT}`);
});

app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));