const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  name: String,
  message: String,
  city: String,
  state: String,
  doi: Date,
  email: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Complaint', complaintSchema);
