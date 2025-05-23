// models/Poll.js
const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,  // Ensures one poll per email
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  q1: {
    type: String,
    enum: ['Yes', 'No'],
    required: true
  },
  q2: {
    type: String,
    enum: ['Yes', 'No'],
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
