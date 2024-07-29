const mongoose = require('mongoose');

//TODO: Add this to swagger
const AdminnotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please tell us the title of the notification!'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please tell us the description of the notification!'],
      trim: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  }
);

const Adminnot = mongoose.model('Notification', AdminnotSchema);

module.exports = Adminnot;
