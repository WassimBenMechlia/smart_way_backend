const mongoose = require('mongoose');
const pointSchema = require('./point.model');
const Preference = require('./preference.model');

const rideSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: {
        values: ['find_a_ride', 'add_a_ride'],
        message: 'Mode is either: find_a_ride or add_a_ride',
      },
      required: [true, 'A ride must have a mode'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A ride must belong to a user'],
    },
    startingPoint: {
      type: pointSchema,
    },
    destination: {
      type: pointSchema,
    },
    date: {
      type: Date,
    },
    occupants: {
      type: Number,
    },
    price: {
      type: Number,
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be above 0.0'],
      max: [5, 'Rating must be below 5.0'],
    },
    
    passengers: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        price: {
          type: Number,
        },
        status: {
          type: String,
          enum: {
            values: ['pending', 'waiting', 'on-the-way', 'arrived'],
            message: 'Status is either: pending, waiting, canceled or arrived',
          },
          default: 'pending',
        },
        rating: {
          type: Number,
          min: [0, 'Rating must be above 0.0'],
          max: [5, 'Rating must be below 5.0'],
          default: 0,
        },
        ratingComment: {
          text: {
            type: String,
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        },
        _id: false,
      },
    ],
    car: {
      type: mongoose.Schema.ObjectId,
      ref: 'Car',
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    //TODO: Add this to swagger
    active: {
      type: Boolean,
      default: true,
    },
    //TODO: Add this to swagger
    status: {
      type: String,
      enum: {
        values: ['pending', 'live', 'canceled', 'completed', 'accepted'],
        message: 'Status is either: pending, live, canceled or completed',
      },
      default: 'pending',
    },
    endDate: {
      type: Date,
    },
    distance: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    isCustom: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


rideSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    // select: 'firstName lastName email phone',
    populate: {
      path: 'preferences.preference',
    },
  }).populate({
    path: 'car',
  });
  next();
});

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;
