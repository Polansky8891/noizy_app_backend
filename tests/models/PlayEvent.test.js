// tests/models/PlayEvent.test.js
const mongoose = require('mongoose');

describe('Model: PlayEvent', () => {
  let PlayEvent;

  beforeAll(() => {
    try { mongoose.deleteModel('PlayEvent'); } catch {}
    PlayEvent = require('../../models/PlayEvent');
  });

  afterAll(() => {
    try { mongoose.deleteModel('PlayEvent'); } catch {}
  });

  test('schema básico: tipos y versionKey off', () => {
    const { schema } = PlayEvent;

    expect(schema.options.versionKey).toBe(false);

    expect(schema.path('userId').instance).toBe('String');
    // 👇 Mongoose usa "ObjectId" (no "ObjectID")
    expect(schema.path('trackId').instance).toBe('ObjectId');
    expect(schema.path('genre').instance).toBe('String');
    expect(schema.path('at').instance).toBe('Date');

    expect(schema.path('userId').isRequired).toBeTruthy();
    expect(schema.path('trackId').isRequired).toBeTruthy();
  });

  test('validación: exige userId y trackId', () => {
    let doc = new PlayEvent({});
    let err = doc.validateSync();
    expect(err.errors.userId).toBeTruthy();
    expect(err.errors.trackId).toBeTruthy();

    doc = new PlayEvent({ userId: 'u1' });
    err = doc.validateSync();
    expect(err.errors.trackId).toBeTruthy();

    doc = new PlayEvent({ trackId: new mongoose.Types.ObjectId() });
    err = doc.validateSync();
    expect(err.errors.userId).toBeTruthy();
  });

  test('default de at usa Date.now en el momento de la creación', () => {
    // En vez de mockear Date.now, comprobamos que cae dentro de una ventana [before, after]
    const before = Date.now();
    const doc = new PlayEvent({
      userId: 'u1',
      trackId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      genre: 'Rock',
      // no pasamos "at" para que use el default
    });
    const after = Date.now();

    expect(doc.at).toBeInstanceOf(Date);
    expect(doc.at.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.at.getTime()).toBeLessThanOrEqual(after);
  });

  test('índices: de campos e índice compuesto { userId:1, at:-1 }', () => {
    const indexes = PlayEvent.schema.indexes(); // [ [fields, options], ... ]

    const hasIndex = (shape) =>
      indexes.some(([fields]) => {
        const keys = Object.keys(shape);
        return (
          keys.length === Object.keys(fields).length &&
          keys.every((k) => fields[k] === shape[k])
        );
      });

    expect(hasIndex({ userId: 1 })).toBe(true);
    expect(hasIndex({ trackId: 1 })).toBe(true);
    expect(hasIndex({ genre: 1 })).toBe(true);
    expect(hasIndex({ at: 1 })).toBe(true);

    expect(hasIndex({ userId: 1, at: -1 })).toBe(true);
  });
});
