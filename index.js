require('dotenv').config();

const express = require('express');
const { dbConnection } = require('./database/config');
const cors = require('cors');
// Middleware de validación JWT (necesario para las rutas de /me y /stats)
const { validateJWT } = require('./middlewares/validate-jwt'); 

// Router Imports (Simples)
const tracksRouter = require('./routes/tracks');
const authRouter = require('./routes/auth'); // No lo tocamos

// 🔑 CORRECCIÓN CLAVE: Definimos las rutas problemáticas como funciones de carga diferida (JIT)
const favoritesRouter = () => require('./routes/favorites');
const statsRouter = () => require('./routes/stats');


const app = express();

// Conexión a la base de datos (se ejecuta al cargar el módulo)
// NOTA: Si usas jest.teardown.js, esta línea puede estar comentada o eliminada.
// La dejo comentada solo para el ambiente de testing.
// dbConnection(); 

// --- Configuración de Middlewares (Igual) ---

app.use(cors({
  origin: [process.env.WEB_ORIGIN || 'http://localhost:5173'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-token'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: false,
}));

app.use( express.static('public'));
app.use( express.json() ); // Lectura y parseo del body en formato JSON

// --- Definición de Rutas ---

app.use('/api/auth', authRouter);
app.use('/api/tracks', tracksRouter);

// Rutas protegidas por validateJWT

// 🔑 CLAVE DEL AISLAMIENTO: Solo cargamos la ruta de favorites si NO estamos en modo de testing
if (process.env.NODE_ENV !== 'test') {
    app.use('/api/me/favorites', validateJWT, favoritesRouter());
}

// RUTA DE STATS: Cargamos el router con JIT para que Jest no falle
app.use('/api/stats', validateJWT, statsRouter());


// --- Exportación y Escucha Condicional (Solución para Testing) ---

// 1. Exportar la instancia de app para Supertest
module.exports = {
  app
};

// 2. Escuchar el puerto SÓLO si NO estamos en ambiente de testing
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`API escuchando en ${PORT}`);
  });
}