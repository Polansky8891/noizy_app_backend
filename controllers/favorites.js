const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Track = require('../models/Track');

const asId = (v) => new mongoose.Types.ObjectId(v);

exports.getFavorites = async (req, res) => {
   try {
    const firebaseUid = String(req.uid);
    if (!firebaseUid) return res.status(401).json({ ok:false, msg:'unauthorized' });

    const user = await User.findOne({ firebaseUid }).select('favorites').lean();
    const ids = (user?.favorites || []).map(String);

    const items = ids.length
      ? await Track.find({ _id: { $in: ids.map(asId) } }).lean()
      : [];

    return res.json({ ok:true, favoritesIds: ids, items });
  } catch (e) {
    console.error('[favorites.get]', e);
    return res.status(500).json({ ok:false, msg:'Server error' });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const firebaseUid = String(req.uid);
    if (!firebaseUid) return res.status(401).json({ ok:false, msg:'unauthorized' });

    const { trackId } = req.body || {};
    if (!mongoose.isValidObjectId(trackId)) {
      return res.status(400).json({ ok:false, msg:'invalid trackId' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $setOnInsert: { firebaseUid, createdAt: new Date() },
        $addToSet: { favorites: asId(trackId) },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    ).lean();

    const ids = (user?.favorites || []).map(String);
    return res.json({ ok:true, added:true, trackId, favoritesIds: ids });
  } catch (e) {
    console.error('[favorites.add]', e);
    return res.status(500).json({ ok:false, msg:'Server error' });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const firebaseUid = String(req.uid);
    if (!firebaseUid) return res.status(401).json({ ok:false, msg:'unauthorized' });

    const { trackId } = req.params;
    if (!mongoose.isValidObjectId(trackId)) {
      return res.status(400).json({ ok:false, msg:'invalid trackId' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $pull: { favorites: asId(trackId) },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    const ids = (user?.favorites || []).map(String);
    return res.json({ ok:true, removed:true, trackId, favoritesIds: ids });
  } catch (e) {
    console.error('[favorites.remove]', e);
    return res.status(500).json({ ok:false, msg:'Server error' });
  }
};

