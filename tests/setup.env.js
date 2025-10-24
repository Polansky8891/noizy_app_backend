// tests/setup.env.js
import 'dotenv/config'; // carga .env si lo usas

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || 'test-google-client';

// Silenciar algo de ruido en tests (opcional)
const originalError = console.error;
console.error = (...args) => {
  const msg = String(args[0] || '');
  if (msg.includes('DeprecationWarning')) return;
  originalError(...args);
};
