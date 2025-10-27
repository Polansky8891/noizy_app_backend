const mongoose = require('mongoose');

// CORRECCIÓN DE RUTAS
const { summary, tick } = require('../../controllers/stats.js'); 

// Importar los Mocks de Modelos
const ListeningTick = require('../../models/ListeningTick');
const PlayEvent = require('../../models/PlayEvent');
const Track = require('../../models/Track');

// --- SETUP DE MOCKING ---

// Mock de Mongoose
jest.mock('../../models/ListeningTick', () => ({ aggregate: jest.fn(), insertMany: jest.fn(), }));
jest.mock('../../models/PlayEvent', () => ({ aggregate: jest.fn(), }));
jest.mock('../../models/Track', () => ({ find: jest.fn(), collection: { name: 'tracks' }, }));

// Configuración de Promesas y Mocks
Track.find.mockReturnThis();
Track.find.lean = jest.fn().mockResolvedValue([]);
ListeningTick.insertMany = jest.fn().mockResolvedValue({});
mongoose.Types.ObjectId = jest.fn((v) => v);

// Simulamos la validación de ObjectId (Sin implementación inicial en global)
mongoose.isValidObjectId = jest.fn();

// Mockear Date.now()
const MOCK_TIME = new Date('2025-10-27T10:00:00.000Z').getTime();
global.Date.now = jest.fn(() => MOCK_TIME);

// Objetos comunes
const MOCK_UID = 'testFirebaseUid1234567890';
const mockRes = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  sendStatus: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  Track.find.lean.mockResolvedValue([]);
  ListeningTick.aggregate.mockClear();
  PlayEvent.aggregate.mockClear();
  ListeningTick.insertMany.mockClear().mockResolvedValue({});

  // **CORRECCIÓN CLAVE:** Limpiamos la implementación para que cada test la defina
  mongoose.isValidObjectId.mockImplementation(jest.fn());
  
  // Mocks de aggregate base
  ListeningTick.aggregate.mockImplementation(() => Promise.resolve([]));
  PlayEvent.aggregate.mockImplementation(() => Promise.resolve([]));
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
      expect.objectContaining({ minutes: 0, plays: 0, uniqueTracks: 0, topGenres: [], })
    );
  });

  it('1.4 Debe retornar datos correctos y calculados (Minutos, Plays y Géneros)', async () => {
    const dailyData = [{ _id: '2025-10-25', ms: 60000 }, { _id: '2025-10-26', ms: 120000 }];
    const playsAggData = [{ plays: 10, uniqueTracks: 5 }];
    const topGenresExpected = [
        { genre: 'Rock', ms: 100000 },
        { genre: 'Pop', ms: 50000 },
    ];
    
    ListeningTick.aggregate.mockResolvedValueOnce(dailyData);
    PlayEvent.aggregate.mockResolvedValueOnce(playsAggData);
    ListeningTick.aggregate.mockResolvedValueOnce(topGenresExpected);

    await summary(reqBase, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        minutes: 3,
        plays: 10,
        uniqueTracks: 5,
        topGenres: topGenresExpected,
        daily: [{ date: '2025-10-25', ms: 60000 }, { date: '2025-10-26', ms: 120000 }],
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
    // Implementación específica SÓLO para este test de fallo (para no contaminar 2.4/2.5)
    mongoose.isValidObjectId.mockImplementation((id) => id === validTrackId);
    
    const invalidTicks = [
      { trackId: 'shortId', ms: 55000 }, 
      { trackId: validTrackId, ms: 4999 }, 
    ];
    await tick({ uid: MOCK_UID, body: { ticks: invalidTicks } }, res);

    expect(ListeningTick.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid ticks' });
  });

  it('2.4 Debe insertar ticks válidos sin fallback y devolver saved: N', async () => {
    // Implementación específica para este test de éxito
    mongoose.isValidObjectId.mockImplementation((id) => id === validTrackId);
    
    const validTicks = [{
      trackId: validTrackId,
      ms: 55000,
      genre: 'Pop',
      at: '2025-10-27T09:30:00.000Z',
    }];

    await tick({ uid: MOCK_UID, body: { ticks: validTicks } }, res);

    expect(Track.find).not.toHaveBeenCalled(); // No se necesita fallback
    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1); 
    expect(res.json).toHaveBeenCalledWith({ ok: true, saved: 1 });
  });

  it('2.5 Debe usar Track fallback si el género está ausente o es "unknown"', async () => {
    // Implementación específica para este test de éxito (validar ambos IDs)
    mongoose.isValidObjectId.mockImplementation((id) => id === validTrackId || id === trackIdNeedsFallback);
    
    const ticks = [
      { trackId: validTrackId, ms: 10000, genre: 'unknown' },
      { trackId: trackIdNeedsFallback, ms: 15000, genre: null },
    ];
    
    // Mockear que Track.find encuentra los géneros
    Track.find.lean.mockResolvedValueOnce([
      { _id: validTrackId, genre: 'Rock' },
      { _id: trackIdNeedsFallback, genre: 'Jazz' },
    ]);

    await tick({ uid: MOCK_UID, body: { ticks: ticks } }, res);

    expect(ListeningTick.insertMany).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true, saved: 2 });
  });
});