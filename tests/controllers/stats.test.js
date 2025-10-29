// tests/controllers/stats.test.js
const mongoose = require('mongoose');

// Controllers a probar
const { summary, tick } = require('../../controllers/stats.js');

// ─────────────────────────── Mocks de modelos (inline factories) ───────────────────────────
jest.mock('../../models/ListeningTick', () => ({
  aggregate: jest.fn(),
  insertMany: jest.fn(),
}));
jest.mock('../../models/PlayEvent', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/Track', () => {
  // Mock encadenable: find() -> { select() -> this, lean() -> Promise }
  const select = jest.fn().mockReturnThis();
  const lean = jest.fn().mockResolvedValue([]); // default vacío
  const find = jest.fn(() => ({ select, lean }));
  return {
    find,
    __select: select, // por si quieres inspeccionar en asserts
    __lean: lean,
    collection: { name: 'tracks' },
  };
});

// Recupera referencias de los mocks para configurarlos en cada test
const ListeningTick = require('../../models/ListeningTick');
const PlayEvent = require('../../models/PlayEvent');
const Track = require('../../models/Track');

// ─────────────────────────── Utilidades comunes ───────────────────────────
const MOCK_TIME = new Date('2025-10-27T10:00:00.000Z').getTime();
const MOCK_UID = 'testFirebaseUid1234567890';

const mockRes = () => ({
  json: jest.fn(),
  status: jest.fn(function (code) { this._status = code; return this; }),
  sendStatus: jest.fn(function (code) { this._status = code; return this; }),
});

beforeAll(() => {
  // Mock estable de Date.now
  jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIME);
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();

  // Defaults seguros para los modelos
  ListeningTick.aggregate.mockResolvedValue([]);
  ListeningTick.insertMany.mockResolvedValue({});
  PlayEvent.aggregate.mockResolvedValue([]);

  // Track.find por defecto devuelve un objeto encadenable con lean() => []
  Track.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });

  // ObjectId helpers seguros para tests (no dependemos de Mongoose real)
  mongoose.Types.ObjectId = jest.fn((v) => v);

  // Cada test define su validación según necesite
  jest.spyOn(mongoose, 'isValidObjectId').mockImplementation(() => true);
});

// ===================================
// 1. TESTS PARA summary (Agregación)
// ===================================
describe('Stats Controller - summary', () => {
  const reqBase = { uid: MOCK_UID, query: {} };
  let res;

  beforeEach(() => {
    res = mockRes();
  });

  it('1.1 Debe retornar 401 si no está autorizado', async () => {
    await summary({ uid: null, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('1.2 Debe limitar los días de consulta entre 1 y 90', async () => {
    await summary({ uid: MOCK_UID, query: { days: 100 } }, res);
    expect(res.json.mock.calls[0][0].days).toBe(90);

    await summary({ uid: MOCK_UID, query: { days: 0 } }, res);
    expect(res.json.mock.calls[1][0].days).toBe(7);
  });

  it('1.3 Debe retornar 0s si no hay datos de agregación', async () => {
    await summary(reqBase, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        minutes: 0,
        plays: 0,
        uniqueTracks: 0,
        topGenres: [],
      })
    );
  });

  it('1.4 Debe retornar datos correctos y calculados (Minutos, Plays y Géneros)', async () => {
    const dailyData = [
      { _id: '2025-10-25', ms: 60000 },
      { _id: '2025-10-26', ms: 120000 },
    ];
    const playsAggData = [{ plays: 10, uniqueTracks: 5 }];
    const topGenresExpected = [
      { genre: 'Rock', ms: 100000 },
      { genre: 'Pop', ms: 50000 },
    ];

    // El controller probablemente hace 3 agregaciones: daily, plays, topGenres
    ListeningTick.aggregate
      .mockResolvedValueOnce(dailyData)        // daily
      .mockResolvedValueOnce(topGenresExpected); // topGenres (si va después)

    PlayEvent.aggregate.mockResolvedValueOnce(playsAggData); // plays + unique

    await summary(reqBase, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        minutes: 3, // 180000 ms -> 3 min
        plays: 10,
        uniqueTracks: 5,
        topGenres: topGenresExpected,
        daily: [
          { date: '2025-10-25', ms: 60000 },
          { date: '2025-10-26', ms: 120000 },
        ],
      })
    );
  });
});

// ===================================
// 2. TESTS PARA tick (Escritura)
// ===================================
describe('Stats Controller - tick', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
  });

  const validTrackId = '60a1234567890abcdef01234a';
  const trackIdNeedsFallback = '60c9876543210fedcba98765';

  it('2.1 Debe retornar 401 si no está autorizado', async () => {
    await tick({ uid: null, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('2.2 Debe retornar 400 si la matriz de ticks está vacía o es inválida', async () => {
    await tick({ uid: MOCK_UID, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'empty ticks' });
  });

  it('2.3 Debe retornar 400 si ningún tick pasa la validación', async () => {
    // Solo este ID es válido
    mongoose.isValidObjectId.mockImplementation((id) => id === validTrackId);

    const invalidTicks = [
      { trackId: 'shortId', ms: 55000 }, // id inválido
      { trackId: validTrackId, ms: 4999 }, // ms < 5000
    ];

    await tick({ uid: MOCK_UID, body: { ticks: invalidTicks } }, res);

    expect(ListeningTick.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid ticks' });
  });

  it('2.4 Debe insertar ticks válidos sin fallback y devolver saved: N', async () => {
    mongoose.isValidObjectId.mockImplementation((id) => id === validTrackId);

    const validTicks = [
      {
        trackId: validTrackId,
        ms: 55000,
        genre: 'Pop',
        at: '2025-10-27T09:30:00.000Z',
      },
    ];

    await tick({ uid: MOCK_UID, body: { ticks: validTicks } }, res);

    expect(Track.find).not.toHaveBeenCalled(); // no hace falta fallback
    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true, saved: 1 });
  });

  it('2.5 Debe usar Track fallback si el género está ausente o es "unknown"', async () => {
    // Ambos IDs válidos
    mongoose.isValidObjectId.mockImplementation(
      (id) => id === validTrackId || id === trackIdNeedsFallback
    );

    const ticks = [
      { trackId: validTrackId, ms: 10000, genre: 'unknown' },
      { trackId: trackIdNeedsFallback, ms: 15000, genre: null },
    ];

    // El controller hará algo como: Track.find({ _id: { $in: [...] } }).select('genre').lean()
    // Devolvemos los géneros para fallback
    Track.find.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: validTrackId, genre: 'Rock' },
        { _id: trackIdNeedsFallback, genre: 'Jazz' },
      ]),
    });

    await tick({ uid: MOCK_UID, body: { ticks } }, res);

    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true, saved: 2 });
  });
});
