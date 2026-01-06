const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  countyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'County',
    required: true,
    unique: true
  },
  contacts: [{
    role: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    }
  }]
}, {
  timestamps: true
});

// Database index for performance
contactSchema.index({ countyId: 1 });

module.exports = mongoose.model('Contact', contactSchema);

