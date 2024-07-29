const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const Preference = require('../models/preference.model');
const User = require('../models/user.model');

exports.getAllPreferences = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  const preferences = await Preference.find({
    $or: [
      { isCreatedByAdmin: true },
      {
        _id: {
          $in: user.preferences.map((preference) => preference.preference),
        },
      },
    ],
  });

  return res.status(200).json({
    status: 'success',
    results: preferences.length,
    data: preferences,
  });
});

exports.createPreference = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  const data = {
    ...req.body,
    isCreatedByAdmin: user.role === 'admin',
  };

  const preference = await Preference.create(data);

  if (user.role === 'user') {
    const newPreference = {
      preference: preference._id,
      isAllowed: true,
    };
    user.preferences.push(newPreference);

    await user.save();
  } else if (user.role === 'admin') {
    const users = await User.find({
      role: { $ne: 'admin' }, // Exclude admin users
      'preferences.preference': { $ne: preference._id }, // Exclude users that have this preference in their preferences array
    });

    users.forEach(async (user) => {
      const newPreference = {
        preference: preference._id,
        isAllowed: false,
      };
      user.preferences.push(newPreference);

      await user.save();
    });
  }

  return res.status(201).json({
    status: 'success',
    data: preference,
  });
});
