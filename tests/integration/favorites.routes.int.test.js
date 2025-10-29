// tests/integration/favorites.routes.int.test.js
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

/* ──────────────── Mocks ──────────────── */
// Mock del middleware de auth: siempre setea req.uid con el valor fijado (incluido '')
jest.mock('../../middlewares/validate-jwt', () => {
  let currentUid = null;
  return {
    __setUid(uid) { currentUid = uid; },
    validateJWT(req, _res, next) {
      // Importante: setear aunque sea '' para que el controller lo reciba tal cual
      if (currentUid !== null) req.uid = currentUid;
      next();
    },
  };
});

// Mocks de modelos
jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/Track', () => ({
  find: jest.fn(),
}));

// Referencias a mocks y router real
const User = require('../../models/User');
const Track = require('../../models/Track');
const authMock = require('../../middlewares/validate-jwt');
const favoritesRouter = require('../../routes/favorites');

const MOCK_UID = 'testFirebaseUid-XYZ';

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/favorites', favoritesRouter);
  return app;
};

// Helpers encadenables
const chainFind = (result) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const chainFindOne = (result) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const chainFindOneAndUpdate = (result) => ({
  lean: jest.fn().mockResolvedValue(result),
});

beforeEach(() => {
  jest.clearAllMocks();

  // Por defecto, autenticado
  authMock.__setUid(MOCK_UID);

  // Stub leve para ObjectId y validador estable
  mongoose.Types.ObjectId = jest.fn((v) => v);
  jest
    .spyOn(mongoose, 'isValidObjectId')
    .mockImplementation((id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id));
});

describe('INT /api/favorites', () => {
  it('GET /api/favorites → 200 con ids e items', async () => {
    const id1 = '507f1f77bcf86cd799439011';
    const id2 = '507f1f77bcf86cd799439012';

    User.findOne.mockReturnValue(chainFindOne({ favorites: [id1, id2] }));
    Track.find.mockReturnValue(chainFind([
      { _id: id1, title: 'Song 1' },
      { _id: id2, title: 'Song 2' },
    ]));

    const app = makeApp();
    const res = await request(app).get('/api/favorites').expect(200);

    expect(res.body).toEqual({
      ok: true,
      favoritesIds: [id1, id2],
      items: [
        { _id: id1, title: 'Song 1' },
        { _id: id2, title: 'Song 2' },
      ],
    });

    expect(User.findOne).toHaveBeenCalledWith({ firebaseUid: MOCK_UID });
    expect(Track.find).toHaveBeenCalled();
  });

  it('GET /api/favorites → 401 si el middleware fija uid vacío', async () => {
    // Fijamos uid vacío ('') para que String(req.uid) === '' y el controller devuelva 401
    authMock.__setUid('');

    const app = makeApp();
    const res = await request(app).get('/api/favorites').expect(401);

    expect(res.body).toEqual({ ok: false, msg: 'unauthorized' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('POST /api/favorites → 200 añade y devuelve ids', async () => {
    const trackId = '507f1f77bcf86cd799439011';

    User.findOneAndUpdate.mockReturnValue(
      chainFindOneAndUpdate({
        firebaseUid: MOCK_UID,
        favorites: [trackId],
      })
    );

    const app = makeApp();
    const res = await request(app)
      .post('/api/favorites')
      .send({ trackId })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      added: true,
      trackId,
      favoritesIds: [trackId],
    });
    expect(User.findOneAndUpdate).toHaveBeenCalled();
  });

  it('POST /api/favorites → 400 si trackId inválido', async () => {
    // Garantizamos que el validador responda false
    mongoose.isValidObjectId.mockReturnValue(false);

    const app = makeApp();
    const res = await request(app)
      .post('/api/favorites')
      .send({ trackId: 'invalid' })
      .expect(400);

    expect(res.body).toEqual({ ok: false, msg: 'invalid trackId' });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('DELETE /api/favorites/:trackId → 200 elimina y devuelve ids', async () => {
    const trackId = '507f1f77bcf86cd799439011';

    User.findOneAndUpdate.mockReturnValue(
      chainFindOneAndUpdate({
        firebaseUid: MOCK_UID,
        favorites: [], // ya sin el id
      })
    );

    const app = makeApp();
    const res = await request(app)
      .delete(`/api/favorites/${trackId}`)
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      removed: true,
      trackId,
      favoritesIds: [],
    });
    expect(User.findOneAndUpdate).toHaveBeenCalled();
  });

  it('DELETE /api/favorites/:trackId → 400 si trackId inválido', async () => {
    mongoose.isValidObjectId.mockReturnValue(false);

    const app = makeApp();
    const res = await request(app)
      .delete('/api/favorites/not-an-id')
      .expect(400);

    expect(res.body).toEqual({ ok: false, msg: 'invalid trackId' });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
