const mongoose = require('mongoose');
const Track = require('../models/Track');
const cloudinary = require('../utils/cloudinary');
const path = require('path');
require('dotenv').config();

mongoose.connect(process.env.DB_CNN);

const tracks = [
    {
        title: 'Dark techno instrumental',
        artist: 'Nick Panek',
        genre: 'Techno',
        duration: 132,
        audioPath: path.join(__dirname, '../assets/audio/techno/dark_techno_instrumental.mp3'),
        coverPath: path.join(__dirname, '../assets/images/techno/dark_techno_instrumental.png')
    },
    
];

(async () => {
    for (const track of tracks) {
        const audioUpload = await cloudinary.uploader.upload(track.audioPath, {
            resource_type: 'video',
            folder: 'noizzy/audio',
        });

        console.log(track.coverPath)
        const coverUpload = await cloudinary.uploader.upload(track.coverPath, {
            folder: 'noizzy/covers',
        });

        const newTrack = new Track({
            title: track.title,
            artist: track.artist,
            genre: track.genre,
            duration: track.duration,
            audioUrl: audioUpload.secure_url,
            coverUrl: coverUpload.secure_url,
        });

        await newTrack.save();
        console.log(`✔️ Track "${track.title}" subido`);
    }

    mongoose.disconnect();
})();


