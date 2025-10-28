const request = require('supertest');
const express = require('express');

/* 👇 Import directo por cadena. Nada de path.join ni variables. */
jest.mock('../../models/Track', () => ({ find: jest.fn() }));

const Track = require('../../models/Track');          // mismo id de módulo
const router = require('../../routes/tracks');        // SUT

const makeApp = () => {
  const app = express();
  app.use('/tracks', router);
  return app;
};

describe('GET /tracks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Utilidad: preparar la cadena find().limit().lean() */
  const mockFindChain = (docs, capture = {}) => {
    Track.find.mockImplementation((q = {}) => {
      capture.query = q;
      const chain = {
        _limitCalledWith: undefined,
        limit(n) {
          capture.limit = n;
          this._limitCalledWith = n;
          return this;
        },
        lean: jest.fn().mockResolvedValue(docs),
      };
      return chain;
    });
  };

  test('devuelve items mapeados y parsea duration en múltiples formatos', async () => {
    const docs = [
      { _id: '1', title: 'Song A', artist: 'A1', duration: 185, genre: 'Rock', coverUrl: 'c1', audioUrl: 'u1', feel: 'HAPPY' },
      { _id: '2', name: 'Song B', author: 'B1', duration: '03:05', Genre: 'Pop', cover: 'c2', url: 'u2', feel: 'Calm' },
      { _id: '3', Title: 'Song C', Artist: 'C1', duration: '200', genre: 'Jazz', coverUrl: 'c3', audioUrl: 'u3', feel: 'mOoDy' },
      { _id: '4', title: 'Song D', artist: 'D1', duration: { seconds: 90 }, genre: 'Rock', coverUrl: 'c4', audioUrl: 'u4', feel: '' },
      { _id: '5', song: 'Song E', singer: 'E1', length: { length: 45 }, Genre: 'House', cover: 'c5', url: 'u5', feel: 'LOUD' },
      { _id: '6', title: 'Song F', artist: 'F1', time: undefined, genre: '', coverUrl: '', audioUrl: '', feel: undefined },
    ];
    const cap = {};
    mockFindChain(docs, cap);

    const app = makeApp();
    const res = await request(app).get('/tracks');

    expect(res.status).toBe(200);
    expect(Track.find).toHaveBeenCalledWith({}); // sin filtros
    expect(cap.limit).toBe(0); // por defecto

    expect(res.body).toEqual({
      items: [
        { _id: '1', title: 'Song A', artist: 'A1', duration: 185, genre: 'Rock', coverUrl: 'c1', audioUrl: 'u1', feel: 'happy' },
        { _id: '2', title: 'Song B', artist: 'B1', duration: 185, genre: 'Pop',  coverUrl: 'c2', audioUrl: 'u2', feel: 'calm' },
        { _id: '3', title: 'Song C', artist: 'C1', duration: 200, genre: 'Jazz', coverUrl: 'c3', audioUrl: 'u3', feel: 'moody' },
        { _id: '4', title: 'Song D', artist: 'D1', duration: 90,  genre: 'Rock', coverUrl: 'c4', audioUrl: 'u4', feel: '' },
        { _id: '5', title: 'Song E', artist: 'E1', duration: 45,  genre: 'House',coverUrl: 'c5', audioUrl: 'u5', feel: 'loud' },
        { _id: '6', title: 'Song F', artist: 'F1', duration: 0,   genre: '',     coverUrl: '',  audioUrl: '',  feel: '' },
      ],
    });
  });

  test('aplica filtros exactos (case-insensitive) para genre y feel, y aplica limit numérico', async () => {
    const cap = {};
    mockFindChain([{ _id: 'x' }], cap);

    const app = makeApp();
    const res = await request(app).get('/tracks?genre=RoCk&feel=HAPPy&limit=24');

    expect(res.status).toBe(200);
    // Verificamos que creó regex ancladas y con flag 'i'
    expect(cap.query).toBeDefined();
    expect(cap.query.genre instanceof RegExp).toBe(true);
    expect(cap.query.genre.source).toBe('^RoCk$'); // tal cual el texto (escapeRegex aplicado si hiciera falta)
    expect(cap.query.genre.flags).toContain('i');

    expect(cap.query.feel instanceof RegExp).toBe(true);
    expect(cap.query.feel.source).toBe('^happy$'); // feel se pasa a lowercase
    expect(cap.query.feel.flags).toContain('i');

    expect(cap.limit).toBe(24);
  });

  test('escapa metacaracteres peligrosos en filtros', async () => {
    const cap = {};
    mockFindChain([], cap);

    const app = makeApp();
    // caracteres con significado en regex: . * + ? ^ $ { } ( ) | [ ] \
    const weird = 'r.oc{k}[x](a)|^$+?\\';
    await request(app).get(`/tracks?genre=${encodeURIComponent(weird)}&feel=${encodeURIComponent(weird)}`);

    // Si están escapados, el source debe contener backslashes delante de esos símbolos
    const srcG = cap.query.genre.source;
    const srcF = cap.query.feel.source;
    // ambos anclados:
    expect(srcG.startsWith('^')).toBe(true);
    expect(srcG.endsWith('$')).toBe(true);
    expect(srcF.startsWith('^')).toBe(true);
    expect(srcF.endsWith('$')).toBe(true);
    // comprobación básica de que hay escapes (no exhaustiva)
    expect(srcG).toMatch(/\\\./);
    expect(srcG).toMatch(/\\\{/);
    expect(srcG).toMatch(/\\\[/);
    expect(srcG).toMatch(/\\\\/); // la barra invertida misma
  });

  test('responde 500 si la consulta falla', async () => {
    Track.find.mockImplementation(() => ({
      limit() { return this; },
      lean: jest.fn().mockRejectedValue(new Error('DB down')),
    }));

    const app = makeApp();
    const res = await request(app).get('/tracks');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Error fetching tracks' });
  });
});
