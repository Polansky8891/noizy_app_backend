const mongoose = require('mongoose');

const ListeningTickSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true},
    trackId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true},
    genre: { type: String, idnex: true},
    ms: { type: Number, required: true},
    at: { type: Date, default: Date.now, index: true},
}, { versionKey: false });

ListeningTickSchema.index({ userId: 1, at: -1});

module.exports = mongoose.model('ListeningTick', ListeningTickSchema);