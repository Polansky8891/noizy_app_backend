// jest.teardown.js

const mongoose = require('mongoose');

// Código que se ejecuta DESPUÉS de cada test suite.
afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        // Forzamos la desconexión
        await mongoose.disconnect();
        console.log('Jest: Conexión a MongoDB cerrada después de tests.');
    }
    // Prevenimos que el worker se quede colgado
    global.gc && global.gc();
});