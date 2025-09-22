const { Schema, model } = require('mongoose');

const UserSchema = Schema(

   {
    firebaseUid: { type: String, index: true, unique: true, sparse: true },

    name: { type: String, required: false, trim: true },

    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
      sparse: true, 
    },

    password: { type: String, required: false, select: false },

    favorites: [{ type: Schema.Types.ObjectId, ref: 'Track', index: true }],
  },
  { timestamps: true }
);

UserSchema.index({ firebaseUid: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = model('User', UserSchema);