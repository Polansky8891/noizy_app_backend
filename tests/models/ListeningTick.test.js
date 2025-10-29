// tests/models/ListeningTick.test.js
const mongoose = require('mongoose');

describe('Model: ListeningTick', () => {
  let ListeningTick;

  beforeAll(() => {
    // evita OverwriteModelError si el runner recarga módulos
    try { mongoose.deleteModel('ListeningTick'); } catch {}
    ListeningTick = require('../../models/ListeningTick');
  });

  afterAll(() => {
    try { mongoose.deleteModel('ListeningTick'); } catch {}
  });

  test('schema básico: tipos, required y versionKey off', () => {
    const { schema } = ListeningTick;

    expect(schema.options.versionKey).toBe(false);

    expect(schema.path('userId').instance).toBe('String');
    expect(schema.path('trackId').instance).toBe('ObjectId'); // ojo: "ObjectId"
    expect(schema.path('genre').instance).toBe('String');
    expect(schema.path('ms').instance).toBe('Number');
    expect(schema.path('at').instance).toBe('Date');

    expect(schema.path('userId').isRequired).toBeTruthy();
    expect(schema.path('trackId').isRequired).toBeTruthy();
    expect(schema.path('ms').isRequired).toBeTruthy();

    // límites en ms
    const msPath = schema.path('ms');
    expect(msPath.options.min).toBe(0);
    expect(msPath.options.max).toBe(60000);
  });

  test('validación de ms (min/max) y required', () => {
    // faltan obligatorios
    let doc = new ListeningTick({});
    let err = doc.validateSync();
    expect(err.errors.userId).toBeTruthy();
    expect(err.errors.trackId).toBeTruthy();
    expect(err.errors.ms).toBeTruthy();

    // ms < 0
    doc = new ListeningTick({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId(),
      ms: -1,
    });
    err = doc.validateSync();
    expect(err.errors.ms).toBeTruthy();

    // ms > 60000
    doc = new ListeningTick({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId(),
      ms: 60001,
    });
    err = doc.validateSync();
    expect(err.errors.ms).toBeTruthy();

    // límites válidos: 0 y 60000
    doc = new ListeningTick({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId(),
      ms: 0,
    });
    err = doc.validateSync();
    expect(err).toBeUndefined();

    doc = new ListeningTick({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId(),
      ms: 60000,
    });
    err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('default de at usa Date.now (ventana temporal)', () => {
    const before = Date.now();
    const doc = new ListeningTick({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      ms: 1234,
      // sin "at" → usa default
    });
    const after = Date.now();

    expect(doc.at).toBeInstanceOf(Date);
    expect(doc.at.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.at.getTime()).toBeLessThanOrEqual(after);
  });

  test('índices: campos e índices compuestos', () => {
    const indexes = ListeningTick.schema.indexes(); // [ [fields, options], ... ]

    const hasIndex = (shape) =>
      indexes.some(([fields]) => {
        const keys = Object.keys(shape);
        return (
          keys.length === Object.keys(fields).length &&
          keys.every((k) => fields[k] === shape[k])
        );
      });

    // índices por "index: true" en campos
    expect(hasIndex({ userId: 1 })).toBe(true);
    expect(hasIndex({ trackId: 1 })).toBe(true);
    expect(hasIndex({ genre: 1 })).toBe(true);
    expect(hasIndex({ at: 1 })).toBe(true);

    // índices compuestos definidos en el schema
    expect(hasIndex({ userId: 1, at: -1 })).toBe(true);
    expect(hasIndex({ userId: 1, trackId: 1, at: -1 })).toBe(true);
  });
});
