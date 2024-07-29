const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A preference must have a title'],
    },
    icon: {
      type: String,
    },
    isCreatedByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

preferenceSchema.virtual('isAllowed');

const Preference = mongoose.model('Preference', preferenceSchema);

module.exports = Preference;
