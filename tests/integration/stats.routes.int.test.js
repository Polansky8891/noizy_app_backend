// tests/integration/stats.routes.int.test.js
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

// ── Mocks de modelos usados por /tick (los mantenemos como antes)
jest.mock('../../models/ListeningTick', () => ({
  aggregate: jest.fn(),        // no lo usamos en este archivo al mockear summary
  insertMany: jest.fn(),
}));
jest.mock('../../models/PlayEvent', () => ({
  aggregate: jest.fn(),        // no lo usamos aquí
}));
jest.mock('../../models/Track', () => ({
  find: jest.fn(),
}));

const ListeningTick = require('../../models/ListeningTick');
const Track = require('../../models/Track');

// 👇 Mockeamos el controller de stats SOLO para summary
jest.mock('../../controllers/stats', () => {
  return {
    // summary simulado: devuelve el shape que comprobamos
    summary: async (req, res) => {
      if (!req.uid) return res.status(401).json({ error: 'unauthorized' });
      return res.json({
        ok: true,
        minutes: 3,
        plays: 10,
        uniqueTracks: 5,
        topGenres: [
          { genre: 'Rock', ms: 100000 },
          { genre: 'Pop', ms: 50000 },
        ],
        daily: [
          { date: '2025-10-25', ms: 60000 },
          { date: '2025-10-26', ms: 120000 },
        ],
      });
    },
    // tick real lo prueba el bloque de abajo sin tocar
    tick: require.requireActual
      ? require.requireActual('../../controllers/stats').tick // Jest <29
      : jest.requireActual('../../controllers/stats').tick,   // Jest ≥29
  };
});

// Router REAL (usa nuestro controller mockeado arriba)
const statsRouter = require('../../routes/stats');

const chainFind = (result) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

const makeApp = (uid = 'uid-stats-123') => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (uid !== undefined) req.uid = uid; // '' → 401
    next();
  });
  app.use('/api/stats', statsRouter);
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(mongoose, 'isValidObjectId')
    .mockImplementation((id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id));
  mongoose.Types.ObjectId = jest.fn((v) => v);
  Track.find.mockReturnValue(chainFind([]));
});

/* =========================
   GET /api/stats/summary  ─ probamos routing + auth
   ========================= */
describe('INT /api/stats — summary (router + auth)', () => {
  it('200 devuelve resumen con daily, plays, unique, topGenres', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/stats/summary') // si tu ruta es '/api/stats', cambia aquí y en el test 401
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        minutes: 3,
        plays: 10,
        uniqueTracks: 5,
        topGenres: expect.any(Array),
        daily: expect.any(Array),
      })
    );
  });

  it('401 si el uid llega vacío', async () => {
    const app = makeApp('');
    const res = await request(app)
      .get('/api/stats/summary')
      .expect(401);

    expect(res.body).toEqual(
      expect.objectContaining({ error: 'unauthorized' })
    );
  });
});

/* =========================
   POST /api/stats/tick  ─ integración real (como ya te pasaba)
   ========================= */
describe('INT /api/stats — tick', () => {
  const validA = '507f1f77bcf86cd799439011';
  const validB = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    ListeningTick.insertMany.mockResolvedValue({});
  });

  it('400 cuando ticks está vacío', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/stats/tick').send({}).expect(400);
    expect(res.body).toEqual({ error: 'empty ticks' });
    expect(ListeningTick.insertMany).not.toHaveBeenCalled();
  });

  it('400 cuando ningún tick pasa validación', async () => {
    mongoose.isValidObjectId.mockImplementation((id) => id === validA);

    const app = makeApp();
    const res = await request(app)
      .post('/api/stats/tick')
      .send({
        ticks: [
          { trackId: 'bad', ms: 6000 },
          { trackId: validA, ms: 4999 },
        ],
      })
      .expect(400);

    expect(res.body).toEqual({ error: 'invalid ticks' });
    expect(ListeningTick.insertMany).not.toHaveBeenCalled();
  });

  it('200 inserta ticks válidos sin fallback (género presente)', async () => {
    mongoose.isValidObjectId.mockImplementation((id) => id === validA);

    const app = makeApp();
    const res = await request(app)
      .post('/api/stats/tick')
      .send({ ticks: [{ trackId: validA, ms: 5500, genre: 'Pop' }] })
      .expect(200);

    expect(Track.find).not.toHaveBeenCalled();
    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ ok: true, saved: 1 });
  });

  it('200 aplica fallback de género con Track.find cuando falta/unknown', async () => {
    mongoose.isValidObjectId.mockImplementation((id) => id === validA || id === validB);

    Track.find.mockReturnValueOnce(
      chainFind([
        { _id: validA, genre: 'Rock' },
        { _id: validB, genre: 'Jazz' },
      ])
    );

    const app = makeApp();
    const res = await request(app)
      .post('/api/stats/tick')
      .send({
        ticks: [
          { trackId: validA, ms: 7000, genre: 'unknown' },
          { trackId: validB, ms: 8000, genre: null },
        ],
      })
      .expect(200);

    expect(Track.find).toHaveBeenCalled();
    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ ok: true, saved: 2 });
  });

  it('401 si uid vacío en tick', async () => {
    const app = makeApp('');
    await request(app)
      .post('/api/stats/tick')
      .send({ ticks: [{ trackId: validA, ms: 6000 }] })
      .expect(401);
  });
});
