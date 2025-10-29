// tests/models/User.test.js
const mongoose = require('mongoose');

describe('Model: User', () => {
  let User;

  beforeAll(() => {
    try { mongoose.deleteModel('User'); } catch {}
    User = require('../../models/User'); // ajusta la ruta si es necesario
  });

  afterAll(() => {
    try { mongoose.deleteModel('User'); } catch {}
  });

  const expectIndexFlagTruthy = (schemaPath, opts = {}) => {
    const flag = schemaPath._index;
    expect(Boolean(flag)).toBe(true);
    if (flag && typeof flag === 'object') {
      // valida solo las claves que nos interesan si existen
      for (const [k, v] of Object.entries(opts)) {
        expect(flag[k]).toBe(v);
      }
    }
  };

  test('schema básico: tipos, opciones y timestamps', () => {
    const { schema } = User;

    // timestamps activados
    expect(schema.options.timestamps).toBe(true);
    expect(schema.path('createdAt')).toBeTruthy();
    expect(schema.path('updatedAt')).toBeTruthy();

    // tipos principales
    expect(schema.path('firebaseUid').instance).toBe('String');
    expect(schema.path('name').instance).toBe('String');
    expect(schema.path('email').instance).toBe('String');
    expect(schema.path('password').instance).toBe('String');

    // password select:false
    expect(schema.path('password').options.select).toBe(false);

    // name trim
    expect(schema.path('name').options.trim).toBe(true);

    // email trim + lowercase + index (puede ser boolean u objeto con opciones)
    expect(schema.path('email').options.trim).toBe(true);
    expect(schema.path('email').options.lowercase).toBe(true);
    expectIndexFlagTruthy(schema.path('email'), { unique: true, sparse: true });

    // firebaseUid index (también puede venir como objeto con opciones)
    expectIndexFlagTruthy(schema.path('firebaseUid'), { unique: true, sparse: true });

    // favorites: array de ObjectId con ref 'Track'
    const favPath = schema.path('favorites');
    expect(favPath.instance).toBe('Array');
    expect(favPath.caster.instance).toBe('ObjectId');
    expect(favPath.caster.options.ref).toBe('Track');
  });

  test('setters: name se trimea y email se guarda en lowercase', () => {
    const doc = new User({
      firebaseUid: 'uid-123',
      name: '  Ada Lovelace  ',
      email: 'Ada.LOVELACE@Example.COM',
      password: 'secret',
      favorites: [],
    });

    expect(doc.name).toBe('Ada Lovelace');
    expect(doc.email).toBe('ada.lovelace@example.com');
  });

  test('índices definidos (simples y compuestos con unique/sparse)', () => {
    const indexes = User.schema.indexes(); // [ [fields, options], ... ]

    const hasIndex = (shape, optMatcher = {}) =>
      indexes.some(([fields, opts = {}]) => {
        const sameFields =
          Object.keys(shape).length === Object.keys(fields).length &&
          Object.entries(shape).every(([k, v]) => fields[k] === v);
        if (!sameFields) return false;
        return Object.entries(optMatcher).every(([k, v]) => opts[k] === v);
      });

    // índices únicos/sparse declarados explícitamente
    expect(hasIndex({ email: 1 }, { unique: true, sparse: true })).toBe(true);
    expect(hasIndex({ firebaseUid: 1 }, { unique: true, sparse: true })).toBe(true);

    // índice simple en favorites (por field-level index:true en el array)
    expect(hasIndex({ favorites: 1 })).toBe(true);
  });
});
