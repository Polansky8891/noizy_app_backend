const mongoose = require('mongoose');

const ListeningTickSchema = new mongoose.Schema({
    userId: { type: String, index: true, required: true},
    trackId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true},
    genre: { type: String, index: true},
    ms: { type: Number, required: true, min: 0, max: 60000},
    at: { type: Date, default: Date.now, index: true},
}, { versionKey: false });

ListeningTickSchema.index({ userId: 1, at: -1});
ListeningTickSchema.index({ userId: 1, trackId: 1, at: -1});

module.exports = mongoose.model('ListeningTick', ListeningTickSchema);