const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Checklist progress - stores which items are completed
  checklistProgress: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  // Saved/favorite properties
  favoriteProperties: [{
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    address: {
      street: String,
      city: String,
      province: String
    },
    askingPrice: Number,
    bedrooms: Number,
    bathrooms: Number,
    squareFeet: Number,
    propertyType: String,
    image: String,
    savedAt: { type: Date, default: Date.now }
  }]
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
