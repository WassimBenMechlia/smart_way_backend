const mongoose = require('mongoose');
const Message = require('./message.model');
const pointSchema = require('./point.model');

const tripIntentSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.ObjectId,
      ref: 'Ride',
      required: [true, 'A trip intent must belong to a ride!'],
    },
    passenger: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A trip intent must belong to a passenger!'],
    },
    driver: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A trip intent must belong to a driver!'],
    },
    price: {
      type: Number,
      required: [true, 'A trip intent must have a price!'],
    },
    priceSuggestedBy: {
      type: String,
      enum: {
        values: ['driver', 'passenger'],
        message: 'price suggested by either driver or passenger',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed', 'canceled', 'accepted', 'declined'],
        message:
          'Status is either: pending, completed, canceled, accepted or declined',
      },
      default: 'pending',
    },
    startingPoint: {
      type: pointSchema,
    },
    destination: {
      type: pointSchema,
    },
    canceledBy: {
      type: String,
      enum: {
        values: ['driver', 'passenger'],
        message: 'canceled by is either driver or passenger',
      },
    },
    sender: {
      type: String,
      enum: {
        values: ['driver', 'passenger'],
        message: 'canceled by is either driver or passenger',
      },
      default: 'passenger',
    },
    paymentIntentId: {
      type: String,
    },
    originalFindRide: {
      type: mongoose.Schema.ObjectId,
      ref: 'Ride',
    },
    endDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tripIntentSchema.virtual('message');

const TripIntent = mongoose.model('TripIntent', tripIntentSchema);

module.exports = TripIntent;
