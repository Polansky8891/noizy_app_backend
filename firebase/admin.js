if (process.env.VITEST || process.env.NODE_ENV === "test") {
  // Entorno de Test: Se exporta un objeto vacío (Mock) y se ignora el resto del código.
  // Ya no necesitamos 'return;' porque el código de producción está en el 'else'.
  module.exports = {};
} else {
  // Entorno de Producción: Se inicializa Firebase Admin de forma real.

  const admin = require('firebase-admin');
  const fs = require('fs');

  function logProject() {
    try {
      const opt = admin.app().options || {};
      const projectId =
        opt.projectId ||
        (opt.credential && opt.credential.projectId) ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        'unknown';
      console.log('[FB-ADMIN] project_id:', projectId);
    } catch {}
  }

  function loadServiceAccount() {
    // 3 fuentes posibles (elige 1 en tu .env)
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || null;        // JSON directo
    const b64     = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 || null;    // JSON en base64
    const file    = process.env.FIREBASE_SERVICE_ACCOUNT_FILE || null;        // ruta a .json

    let jsonStr = null;

    if (b64) {
      try {
        jsonStr = Buffer.from(b64, 'base64').toString('utf8');
        console.log('[FB-ADMIN] using service account from JSON_B64');
      } catch (e) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_B64 no es base64 válido');
      }
    } else if (file) {
      try {
        jsonStr = fs.readFileSync(file, 'utf8');
        console.log('[FB-ADMIN] using service account from FILE:', file);
      } catch (e) {
        throw new Error(`No puedo leer FIREBASE_SERVICE_ACCOUNT_FILE (${file}): ${e.message}`);
      }
    } else if (rawJson) {
      // a veces viene envuelta en comillas por dotenv; las quitamos
      let s = rawJson.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1);
      }
      jsonStr = s;
      console.log('[FB-ADMIN] using service account from JSON env (length:', jsonStr.length, ')');
    } else {
      return null;
    }

    let svc;
    try {
      svc = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('El contenido de la service account no es JSON válido: ' + e.message);
    }

    // validación mínima
    if (!svc.project_id || !svc.client_email || !svc.private_key) {
      throw new Error('Service account incompleta: faltan project_id/client_email/private_key');
    }

    // arregla saltos de línea si vienen escapados
    const privateKey =
      typeof svc.private_key === 'string' && svc.private_key.includes('\\n')
        ? svc.private_key.replace(/\\n/g, '\n')
        : svc.private_key;

    return {
      projectId: svc.project_id,
      clientEmail: svc.client_email,
      privateKey,
    };
  }

  if (!admin.apps.length) {
    const sa = loadServiceAccount();

    if (sa) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: sa.projectId,
          clientEmail: sa.clientEmail,
          privateKey: sa.privateKey,
        }),
        projectId: sa.projectId,
      });
      console.log('[FB-ADMIN] initialized with service account:', sa.clientEmail);
      logProject();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // fallback: application default credentials (ruta a fichero .json)
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('[FB-ADMIN] initialized with applicationDefault() from', process.env.GOOGLE_APPLICATION_CREDENTIALS);
      logProject();
    } else {
      console.error('[FB-ADMIN] ❌ No credentials found. Set one of:');
      console.error('  - FIREBASE_SERVICE_ACCOUNT_JSON (JSON en una línea)');
      console.error('  - FIREBASE_SERVICE_ACCOUNT_JSON_B64 (JSON en base64)');
      console.error('  - FIREBASE_SERVICE_ACCOUNT_FILE (ruta a .json)');
      throw new Error('Missing Firebase Admin credentials');
    }
  }

  module.exports = admin;
}
