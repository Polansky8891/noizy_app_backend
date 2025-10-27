// babel.config.js
module.exports = {
  // Configuración base para tu aplicación (si usas React, etc.)
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    // ... otros presets (como '@babel/preset-react')
  ],
  
  // ¡ESTA ES LA CORRECCIÓN CLAVE!
  env: {
    test: {
      // Forzar a usar módulos CommonJS (require) solo durante el testing.
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    },
  },
};