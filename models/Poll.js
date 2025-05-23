const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true }, // ensures one vote per user
  rating: Number,
  agreeSolution: String,
  joinMovement: String,
  submittedAt: { type: Date, default: Date.now }
});

const Poll = mongoose.model('Poll', pollSchema);
