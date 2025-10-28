// tests/routes/favorites.test.js
const express = require('express');
const request = require('supertest');

/* ── Mocks (sin variables externas en los factories) ────────── */
jest.mock('../../middlewares/validate-jwt', () => ({
  validateJWT: jest.fn((req, _res, next) => { req.uid = 'u-123'; next(); }),
}));

jest.mock('../../middlewares/fields-validators', () => ({
  fieldsValidator: (req, res, next) => {
    if (!req.body || !req.body.trackId) {
      return res.status(400).json({
        errors: [{ msg: 'El trackId es obligatorio', param: 'trackId' }],
      });
    }
    next();
  },
}));

jest.mock('../../controllers/favorites', () => ({
  getFavorites: jest.fn((req, res) => res.json({ items: ['t1', 't2'], uid: req.uid })),
  addFavorite: jest.fn((req, res) => res.status(201).json({ ok: true, trackId: req.body.trackId, uid: req.uid })),
  removeFavorite: jest.fn((req, res) => res.json({ ok: true, removed: req.params.trackId, uid: req.uid })),
}));

/* ── Obtén referencias a los mocks ya creados ──────────────── */
const { validateJWT } = require('../../middlewares/validate-jwt');
const favCtrl = require('../../controllers/favorites');

/* ── App con el router SUT ──────────────────────────────────── */
const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/favorites', require('../../routes/favorites'));
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Favorites routes', () => {
  test('GET /favorites requiere JWT y llama al controller', async () => {
    const app = makeApp();
    const res = await request(app).get('/favorites');

    expect(validateJWT).toHaveBeenCalledTimes(1);
    expect(favCtrl.getFavorites).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: ['t1', 't2'], uid: 'u-123' });
  });

  test('POST /favorites → 400 si falta trackId (fieldsValidator corta) y NO llama JWT ni addFavorite', async () => {
    const app = makeApp();
    const res = await request(app).post('/favorites').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.param).toBe('trackId');

    expect(validateJWT).not.toHaveBeenCalled();
    expect(favCtrl.addFavorite).not.toHaveBeenCalled();
  });

  test('POST /favorites con trackId válido pasa por JWT y ejecuta addFavorite', async () => {
    const app = makeApp();
    const res = await request(app).post('/favorites').send({ trackId: '507f1f77bcf86cd799439011' });

    expect(validateJWT).toHaveBeenCalledTimes(1);
    expect(favCtrl.addFavorite).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, trackId: '507f1f77bcf86cd799439011', uid: 'u-123' });
  });

  test('DELETE /favorites/:trackId → 401 si validateJWT corta la petición', async () => {
    // Simula token inválido SOLO en este test
    validateJWT.mockImplementationOnce((_req, res, _next) =>
      res.status(401).json({ msg: 'Token no válido' })
    );

    const app = makeApp();
    const res = await request(app).delete('/favorites/abc123');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ msg: 'Token no válido' });
    expect(favCtrl.removeFavorite).not.toHaveBeenCalled();
  });
});
