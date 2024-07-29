  const mongoose = require("mongoose");

  const pointSchema = new mongoose.Schema(
    {
      business_status: String,
      formatted_address: {
        type: String,
        required: [true, 'A point must have an address'],
      },
      geometry: {
        location: {
          lat: {
            type: Number,
            required: [true, 'A point must have a location latitude'],
          },
          lng: {
            type: Number,
            required: [true, 'A point must have a location longitude'],
          },
        },
        viewport: {
          northeast: {
            lat: {
              type: Number,
              required: [
                true,
                'A point must have a viewport northeast latitude',
              ],
            },
            lng: {
              type: Number,
              required: [
                true,
                'A point must have a viewport northeast longitude',
              ],
            },
          },
          southwest: {
            lat: {
              type: Number,
              required: [
                true,
                'A point must have a viewport southwest latitude',
              ],
            },
            lng: {
              type: Number,
              required: [
                true,
                'A point must have a viewport southwest longitude',
              ],
            },
          },
        },
      },
      icon: String,
      icon_background_color: String,
      icon_mask_base_uri: String,
      name: {
        type: String,
        required: [true, 'A point must have a name'],
      },
      opening_hours: {
        open_now: Boolean,
      },
      photos: [
        {
          height: Number,
          html_attributions: [String],
          photo_reference: String,
          width: Number,
        },
      ],
      place_id: String,
      rating: Number,
      reference: String,
      types: [String],
      user_ratings_total: Number,
    },
  );

  module.exports = pointSchema;
