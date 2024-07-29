
const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const pointSchema = require('./point.model');
const Preference = require('./preference.model');
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    bio: {
      type: String,
    },
    accessToken: {
      type: String,
    },
    photo: {
      type: String,
      default: 'default.jpg',
    },
    isSocialLogin: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    active: {
      type: Boolean,
      default: true,
    },
    preferences: [
      {
        preference: {
          type: mongoose.Schema.ObjectId,
          ref: 'Preference',
        },
        isAllowed: {
          type: Boolean,
          default: true,
        },
        _id: false,
      },
    ],
    defaultCar: {
      type: mongoose.Schema.ObjectId,
      ref: 'Car',
      default: null,
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be above 0.0'],
      max: [5, 'Rating must be below 5.0'],
    },
    seenAt: {
      type: mongoose.Schema.Types.Mixed,
    },
   
    deviceIds: {
      type: [String],
      default: [],
    },
    
    location: {
      latitude: Number,
      longitude: Number,
    },
    password: {
      type: String,
      required: true,
      },
    settings: {
      notifications: {
        type: Boolean,
        default: true,
      },
      messages: {
        type: Boolean,
        default: true,
      },
      requests: {
        type: Boolean,
        default: true,
      },
      suggestions: {
        type: Boolean,
        default: true,
      },
      payment: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        enum: {
          values: ['en', 'fr', 'es', 'de', 'pt', 'ru', 'ja', 'zh', 'it'],
          message: 'Language is either: en, fr, es, de, pt, ru, ja, zh, it',
        },
        default: 'en',
      },
    },
    
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


userSchema.pre(/^find/, function (next) {
  this.populate('preferences.preference');

  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});



userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    return false;
  };
 
  
  userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    return false;
  };
  
  userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');
  
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
  
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
    // console.log(this.passwordResetExpires);
    // console.log(this.passwordResetToken);
    // console.log(resetToken);
  
    return resetToken;
  };
  userSchema.methods.createVerificationToken = function (code) {
    const emailVerificationToken = crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');
    
    // Set the token and expiration time in the user document
    this.emailVerificationToken = emailVerificationToken;
    this.emailVerificationExpires = Date.now() + 5 * 60 * 1000
    };


module.exports = mongoose.model('User',userSchema);