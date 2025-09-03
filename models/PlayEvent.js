const mongoose = require('mongoose');

const PlayEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    trackId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    genre: { type: String, index: true },
    at: { type: Date, default: Date.now, index: true},
}, { versionKey: false});

PlayEventSchema.index({ userId: 1, at: -1});
module.exports = mongoose.model('PlayEvent', PlayEventSchema);



