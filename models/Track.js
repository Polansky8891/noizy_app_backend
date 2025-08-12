const { Schema, model } = require('mongoose');

const TrackSchema = Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    artist: {
        type: String,
        required: true,
    },
    genre: {
        type: String,
        enum: ['Techno', 'Rock', 'Hip-Hop', 'Pop', 'Electro', 'Jazz', 'Blues', 'Classical', 'Dubstep', 'House', 'Reggae'],
        default: 'Other',
    },
    audioUrl: {
        type: String,
        default: '',
    },
    coverUrl: {
        type: String,
        default: '',
    },
    duration: {
        type: Number,
        required: true,
    },
    plays: {
        type: Number,
        default: 0,
    },
    likes: {
        type: Number,
        default: 0,
    },
});

module.exports = model('Track', TrackSchema );

