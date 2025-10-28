// jest.setup.js

const mongoose = require('mongoose');

// Se ejecuta después de que todos los test suites hayan terminado
module.exports = async () => {
  // Solo intenta cerrar si la conexión existe y está abierta
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('Jest: Conexión a MongoDB cerrada.');
    } catch (err) {
      console.error('Jest: Error al cerrar la conexión a MongoDB:', err);
    }
  }
};