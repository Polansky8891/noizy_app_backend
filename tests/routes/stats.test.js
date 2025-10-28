// tests/routes/stats.test.js
const express = require('express');
const request = require('supertest');

/* ─────────────── Mocks (sin variables externas en factories) ─────────────── */

// JWT: por defecto añade uid; en tests puntuales lo haremos “fallar”
jest.mock('../../middlewares/validate-jwt', () => ({
  validateJWT: jest.fn((req, _res, next) => { req.uid = 'u-123'; next(); }),
}));

jest.mock('../../controllers/stats', () => ({
  summary: jest.fn((req, res) => res.json({ ok: true, days: 3 })),
  tick: jest.fn((req, res) => res.json({ ok: true, ticked: true })),
}));

// 👇 Añade esta línea para que NO se evalúe el schema real
jest.mock('../../models/ListeningTick', () => ({}));

const playEventCapture = {};
jest.mock('../../models/PlayEvent', () => ({
  create: jest.fn(),
  find: jest.fn((q) => {
    playEventCapture.query = q;
    return {
      sort(obj) { playEventCapture.sort = obj; return this; },
      limit(n)  { playEventCapture.limit = n; return this; },
      lean: jest.fn().mockResolvedValue([
        { _id: 'e1', userId: q?.userId, trackId: 't1', at: new Date('2024-01-01') },
      ]),
    };
  }),
}));

jest.mock('mongoose', () => ({
  isValidObjectId: jest.fn((v) => v !== 'bad' && !!v),
  Types: { ObjectId: function (v) { return { _value: String(v), toString() { return this._value; } }; } },
}));

/* ─────────────── Obtener referencias a los mocks ─────────────── */
const { validateJWT } = require('../../middlewares/validate-jwt');
const statsCtrl = require('../../controllers/stats');
const PlayEvent = require('../../models/PlayEvent');
const mongoose = require('mongoose');

/* ─────────────── Helper: app con el router SUT ─────────────── */
const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/stats', require('../../routes/stats'));
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
  playEventCapture.query = undefined;
  playEventCapture.sort = undefined;
  playEventCapture.limit = undefined;
});

/* ───────────────────────── Tests ───────────────────────── */

describe('Stats routes', () => {
  describe('POST /stats/play', () => {
    test('crea PlayEvent con uid, trackId (ObjectId) y genre normalizado', async () => {
      PlayEvent.create.mockResolvedValue({ _id: 'x' });

      const app = makeApp();
      const res = await request(app)
        .post('/stats/play')
        .send({ trackId: '507f1f77bcf86cd799439011', genre: 'hip hop' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      // argumentos pasados a create()
      expect(PlayEvent.create).toHaveBeenCalledTimes(1);
      const arg = PlayEvent.create.mock.calls[0][0];
      expect(arg.userId).toBe('u-123');
      expect(arg.trackId).toBeDefined();
      expect(arg.trackId.toString()).toBe('507f1f77bcf86cd799439011');
      expect(arg.genre).toBe('Hip-Hop'); // normalización
      expect(arg.at instanceof Date).toBe(true);
    });

    test('400 si trackId inválido', async () => {
      // nuestra simulación: 'bad' → isValidObjectId = false
      const app = makeApp();
      const res = await request(app)
        .post('/stats/play')
        .send({ trackId: 'bad', genre: 'Classic' });

      expect(mongoose.isValidObjectId).toHaveBeenCalledWith('bad');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ ok: false, code: 'invalid-arg' });
      expect(PlayEvent.create).not.toHaveBeenCalled();
    });

    test('401 si no hay uid (validateJWT no setea req.uid)', async () => {
      validateJWT.mockImplementationOnce((req, _res, next) => next()); // sin uid
      const app = makeApp();
      const res = await request(app)
        .post('/stats/play')
        .send({ trackId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ ok: false, code: 'unauthorized' });
      expect(PlayEvent.create).not.toHaveBeenCalled();
    });

    test('500 si falla la creación en DB', async () => {
      PlayEvent.create.mockRejectedValue(new Error('DB down'));
      const app = makeApp();
      const res = await request(app)
        .post('/stats/play')
        .send({ trackId: '507f1f77bcf86cd799439011', genre: 'classic' });

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ ok: false, code: 'server-error' });
    });
  });

  describe('POST /stats/tick y GET /stats/summary', () => {
    test('POST /stats/tick delega en handler tick', async () => {
      const app = makeApp();
      const res = await request(app).post('/stats/tick').send({ seconds: 15 });

      expect(statsCtrl.tick).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, ticked: true });
    });

    test('GET /stats/summary delega en handler summary', async () => {
      const app = makeApp();
      const res = await request(app).get('/stats/summary');

      expect(statsCtrl.summary).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, days: 3 });
    });
  });

  describe('GET /stats/recent', () => {
    test('protegido por JWT, ordena desc por at y limita a 20', async () => {
      const app = makeApp();
      const res = await request(app).get('/stats/recent');

      expect(validateJWT).toHaveBeenCalledTimes(1);
      expect(PlayEvent.find).toHaveBeenCalledTimes(1);
      expect(playEventCapture.query).toEqual({ userId: 'u-123' });
      expect(playEventCapture.sort).toEqual({ at: -1 });
      expect(playEventCapture.limit).toBe(20);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('_id', 'e1');
    });

    test('401 si validateJWT corta la petición', async () => {
      validateJWT.mockImplementationOnce((_req, res, _next) =>
        res.status(401).json({ ok: false, code: 'unauthorized' })
      );

      const app = makeApp();
      const res = await request(app).get('/stats/recent');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ ok: false, code: 'unauthorized' });
      expect(PlayEvent.find).not.toHaveBeenCalled();
    });
  });
});
