const mongoose = require('mongoose');
const { join } = require('path');
// Removed incorrect import of 'boolean'

const contactSchema = new mongoose.Schema({
  name: String,
  city: String,
  state: String,
  age: Number,
  email: String,
  joinus: Boolean, // Correct type for a checkbox
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Contact', contactSchema);
