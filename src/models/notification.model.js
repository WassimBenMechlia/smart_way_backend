const mongoose = require('mongoose');

//TODO: Add this to swagger
const notificationSchema = new mongoose.Schema(
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
    read: {
      type: Boolean,
      default: false,
    },
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    receiver: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Notification must belong to a receiver!'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
