const { Schema, model } = require('mongoose');

const UserSchema = Schema({

    name: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true,
        unique: true
    },
    password: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true,
        unique: true
    },
    favorites: [{
        type: Schema.Types.ObjectId, ref: 'Track', index: true
    }]
    
}, { timestamps: true});

module.exports = model('User', UserSchema );

