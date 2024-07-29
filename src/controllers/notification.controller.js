const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchasync = require('../utils/catchAsync');
const Notification = require('../models/notification.model');

exports.getNotifications = catchasync(async (req, res, next) => {
  const features = new APIFeatures(
    Notification.find({
      receiver: req.user._id,
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const notifications = await features.query;

  return res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: notifications,
  });
});

exports.getNotification = catchasync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }

  if (notification.receiver.toString() !== req.user._id.toString()) {
    return next(
      new AppError('You are not allowed to access this notification', 403)
    );
  }

  return res.status(200).json({
    status: 'success',
    data: notification,
  });
});
