const mongoose = require('mongoose');

const carSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: [true, 'A car must have a brand'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'A car must have a model'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'A car must have a color'],
      trim: true,
    },
    licensePlateNumber: {
      type: String,
      required: [true, 'A car must have a license plate number'],
      trim: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A car must belong to a user'],
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

carSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name email phone',
  });

  this.find({ active: { $ne: false } });

  next();
});

const Car = mongoose.model('Car', carSchema);

module.exports = Car;
