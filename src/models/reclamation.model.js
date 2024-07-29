const mongoose = require('mongoose');

const reclamationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A reclamation must have a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'A reclamation must have an email'],
      trim: true,
    },
    object: {
      type: String,
      required: [true, 'A reclamation must have an object'],
      enum: ['Covoiturage', 'Parking', 'PublicTransport', 'Autre'],

      trim: true,
    },
    description: {
      type: String,
      required: [true, 'A reclamation must have a description'],
      trim: true,
    },
    // You may want to add more fields such as status, priority, etc.
    // Add those fields as needed for your application
  },
  // {
  //   timestamps: true,
  //   toJSON: { virtuals: true },
  //   toObject: { virtuals: true },
  // }
);

// Virtual populate if needed

const Reclamation = mongoose.model('Reclamation', reclamationSchema);

module.exports = Reclamation;
