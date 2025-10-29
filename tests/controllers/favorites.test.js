// tests/controllers/favorites.test.js
const mongoose = require('mongoose');

// ── Define los mocks **dentro** del factory (inline) ──
jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/Track', () => ({
  find: jest.fn(),
}));

// Ahora sí, importa los mocks para poder configurarlos en los tests
const UserMock = require('../../models/User');
const TrackMock = require('../../models/Track');

// Importa el controller DESPUÉS de los jest.mock
const favorites = require('../../controllers/favorites');

// Helper res (Express-like)
const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn((body) => { res._json = body; return res; });
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(mongoose, 'isValidObjectId').mockImplementation(() => true);
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('favorites.getFavorites', () => {
  it('401 si falta uid', async () => {
    const req = { uid: '' };
    const res = makeRes();

    await favorites.getFavorites(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json).toEqual({ ok:false, msg:'unauthorized' });
  });

  it('ok con lista vacía', async () => {
    UserMock.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ favorites: [] }),
    });

    const req = { uid: 'firebase-uid-1' };
    const res = makeRes();

    await favorites.getFavorites(req, res);

    expect(UserMock.findOne).toHaveBeenCalledWith({ firebaseUid: 'firebase-uid-1' });
    expect(TrackMock.find).not.toHaveBeenCalled();
    expect(res._json).toEqual({ ok:true, favoritesIds: [], items: [] });
  });

  it('ok con ids + items', async () => {
    const id1 = '507f1f77bcf86cd799439011';
    const id2 = '507f1f77bcf86cd799439012';

    UserMock.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        favorites: [new mongoose.Types.ObjectId(id1), new mongoose.Types.ObjectId(id2)],
      }),
    });

    const items = [{ _id: id1, title: 'Song 1' }, { _id: id2, title: 'Song 2' }];
    TrackMock.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(items),
    });

    const req = { uid: 'abc' };
    const res = makeRes();

    await favorites.getFavorites(req, res);

    expect(TrackMock.find).toHaveBeenCalled();
    expect(res._json).toEqual({ ok:true, favoritesIds: [id1, id2], items });
  });

  it('500 en excepción', async () => {
    UserMock.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('db down')),
    });

    const req = { uid: 'x' };
    const res = makeRes();

    await favorites.getFavorites(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json).toEqual({ ok:false, msg:'Server error' });
  });
});

describe('favorites.addFavorite', () => {
  it('401 si falta uid', async () => {
    const req = { uid: '', body: { trackId: '507f1f77bcf86cd799439011' } };
    const res = makeRes();

    await favorites.addFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json).toEqual({ ok:false, msg:'unauthorized' });
  });

  it('400 si trackId inválido', async () => {
    mongoose.isValidObjectId.mockReturnValue(false);

    const req = { uid: 'abc', body: { trackId: 'bad' } };
    const res = makeRes();

    await favorites.addFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json).toEqual({ ok:false, msg:'invalid trackId' });
  });

  it('ok upsert y devuelve ids', async () => {
    const id = '507f1f77bcf86cd799439011';

    UserMock.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        firebaseUid: 'abc',
        favorites: [new mongoose.Types.ObjectId(id)],
      }),
    });

    const req = { uid: 'abc', body: { trackId: id } };
    const res = makeRes();

    await favorites.addFavorite(req, res);

    expect(UserMock.findOneAndUpdate).toHaveBeenCalled();
    expect(res._json).toEqual({ ok:true, added:true, trackId: id, favoritesIds: [id] });
  });

  it('500 en fallo BD', async () => {
    const id = '507f1f77bcf86cd799439011';

    UserMock.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db fail')),
    });

    const req = { uid: 'abc', body: { trackId: id } };
    const res = makeRes();

    await favorites.addFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json).toEqual({ ok:false, msg:'Server error' });
  });
});

describe('favorites.removeFavorite', () => {
  it('401 si falta uid', async () => {
    const req = { uid: '', params: { trackId: '507f1f77bcf86cd799439011' } };
    const res = makeRes();

    await favorites.removeFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json).toEqual({ ok:false, msg:'unauthorized' });
  });

  it('400 si trackId inválido', async () => {
    mongoose.isValidObjectId.mockReturnValue(false);

    const req = { uid: 'abc', params: { trackId: 'bad' } };
    const res = makeRes();

    await favorites.removeFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json).toEqual({ ok:false, msg:'invalid trackId' });
  });

  it('ok elimina y devuelve ids', async () => {
    const id = '507f1f77bcf86cd799439011';

    UserMock.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        firebaseUid: 'abc',
        favorites: [],
      }),
    });

    const req = { uid: 'abc', params: { trackId: id } };
    const res = makeRes();

    await favorites.removeFavorite(req, res);

    expect(UserMock.findOneAndUpdate).toHaveBeenCalled();
    expect(res._json).toEqual({ ok:true, removed:true, trackId: id, favoritesIds: [] });
  });

  it('500 en fallo BD', async () => {
    const id = '507f1f77bcf86cd799439011';

    UserMock.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db fail')),
    });

    const req = { uid: 'abc', params: { trackId: id } };
    const res = makeRes();

    await favorites.removeFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json).toEqual({ ok:false, msg:'Server error' });
  });
});
