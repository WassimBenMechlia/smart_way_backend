const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const Ride = require('../models/ride.model');
const stripeSk = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripePk = require('stripe')(process.env.STRIPE_PUBLIC_KEY);
const Notification = require('../models/notification.model');
const TripIntent = require('../models/trip_intent.model');
const Chat = require('../models/chat.model');
const Message = require('../models/message.model');
const { Types } = require('mongoose');

const {
  sendRealTimeNotification,
  searchRidesDependingOnStartAndEndLocation,
  retrieveCustomer,
  retrieveDefaultCard,
  paymentIntent,
  refundPayment,
  calculateDurationAndDistance,
  calculateApplicationFee
} = require('../utils/sharedFunctions');
const moment = require('moment-timezone');
const User = require('../models/user.model');
const currentDate = new Date();

exports.joinRide = catchAsync(async (req, res, next) => {
  const ride = await Ride.findById(req.params.rideId)
    .populate('user')
    .populate('passengers');

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (ride.user._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot join your own ride', 400));
  }

  if (ride.mode === 'find_a_ride') {
    return next(new AppError('This trip is for finding a ride!', 400));
  }

  const data = {
    ...req.body,
  };

  if (!data.price) {
    data.price = ride.price;
  }

  if (!data.startingPoint || !data.destination) {
    return next(
      new AppError('Starting point and destination are required', 400)
    );
  }

  if (ride.passengers.length >= ride.occupants) {
    return next(new AppError('Ride is full', 400));
  }

  const userInRide = ride.passengers.find(
    (passenger) => passenger.user._id.toString() === req.user._id.toString()
  );

  if (userInRide) {
    return next(new AppError('You are already in this ride', 400));
  }

  const tripIntentExists = await TripIntent.findOne({
    ride: ride._id,
    passenger: req.user._id,
    status: { $nin: ['canceled', 'declined'] },
  });

  if (tripIntentExists) {
    return next(
      new AppError(
        'You have already joined this ride. Please wait for the driver to confirm your request.',
        400
      )
    );
  }


  const tripIntent = await TripIntent.create({
    ride: ride._id,
    passenger: req.user._id,
    driver: ride.user._id,
    price: data.price,
    priceSuggestedBy: data.price === ride.price ? 'driver' : 'passenger',
    startingPoint: data.startingPoint,
    destination: data.destination,
    endDate: ride.date

  });

  const notification = await Notification.create({
    title: 'New Passenger Request for Joining Trip',
    description: `${req.user.firstName} wants to join your trip`,
    sender: tripIntent.passenger._id,
    receiver: tripIntent.driver._id,
  });

  const userToNotify = await User.findById(tripIntent.driver._id).select(
    'settings'
  );
  if (
    userToNotify?.settings?.notifications &&
    userToNotify?.settings?.requests
  ) {

    await sendRealTimeNotification(
      tripIntent.driver._id,
      notification,
      true,
      true
    );
  }

  const driverSocketId = await global.io
    .in(`notifications-${ride.user._id}`)
    .allSockets();

  if (driverSocketId.size > 0) {
    tripIntent.message = `${req.user.firstName} wants to join your trip`;
    for (const socketId of driverSocketId) {
      global.io.to(socketId).emit('joinRide', tripIntent);
    }
  }

  const users = [req.user.id, ride?.user?._id?.toString()];

  let chat = await Chat.findOne({
    users: { $all: users },
  });

  if (chat) {
    const messageCount = await Message.countDocuments({
      chat: chat.id,
    });
    chat.messageCount = messageCount;
    chat.lastMessage = await Message.findOne({
      chat: chat.id,
    })
      .sort({ createdAt: -1 })
      .select('-chat -__v -updatedAt');
  } else {
    chat = await Chat.create({
      users,
      creator: req.user.id,
    });

    chat.users = await User.find({ _id: { $in: chat.users } }).select(
      'firstName lastName email photo'
    );

    chat.creator = await User.findById(chat.creator).select(
      'firstName lastName email photo'
    );

    chat.messageCount = 0;

    chat.lastMessage = null;

    chat.users.forEach((user) => {
      const socket = global.users.find((u) => {
        return u.id === user._id.toString();
      })?.socket;

      if (socket) {
        socket.join(`chat-${chat.id}`);
      }
    });
  }

  return res.status(200).json({
    status: 'success',
    data: tripIntent,
  });
});


exports.suggestAnotherPrice = catchAsync(async (req, res, next) => {
  const tripIntent = await TripIntent.findById(req.params.tripIntentId)
    .populate('ride')
    .populate({
      path: 'passenger',
    })
    .populate({
      path: 'driver',
    });



  if (!tripIntent) {
    return next(new AppError('No tripIntent found with that ID', 404));
  }
  const ride = await Ride.findById(tripIntent.ride._id)
    .populate('user')
    .populate('passengers');


  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  const passengerInTrip = tripIntent.passenger.id.toString() === req.user._id.toString()
  const driverInTrip = tripIntent.driver.id.toString() === req.user._id.toString()

  if (!passengerInTrip && !driverInTrip) {
    return next(new AppError("You don't belong to this trip", 400));
  }


  const data = {
    ...req.body,
  };

  if (!data.price) {
    return next(new AppError('You need to suggest a price', 404));
  }

  if (ride.passengers.length >= ride.occupants) {
    return next(new AppError('Ride is full', 400));
  }

  const userInRide = ride.passengers.find(
    (passenger) => passenger.user._id.toString() === req.user._id.toString()
  );

  if (userInRide) {
    return next(new AppError('User already in this ride', 400));
  }

  tripIntent.price = data.price
  tripIntent.priceSuggestedBy = tripIntent.driver._id.toString() === req.user._id.toString() ? 'driver' : 'passenger'
  await tripIntent.save({ validateBeforeSave: false });


  const notification = await Notification.create(tripIntent.priceSuggestedBy === 'passenger' ? {
    title: 'Passenger Requested Another Price for Joining Trip',
    description: `${req.user.firstName} wants to join your trip for ${tripIntent.price}`,
    sender: tripIntent.passenger._id,
    receiver: tripIntent.driver._id,
  } : {
    title: 'Driver Requested Another Price for Joining His Trip',
    description: `${req.user.firstName} wants you to join his trip for ${tripIntent.price}`,
    sender: tripIntent.driver._id,
    receiver: tripIntent.passenger._id,
  });

  const userToNotify = await User.findById(tripIntent.priceSuggestedBy === 'passenger' ? tripIntent.driver._id : tripIntent.passenger._id).select(
    'settings'
  );
  if (
    userToNotify?.settings?.notifications &&
    userToNotify?.settings?.requests
  ) {
    await sendRealTimeNotification(
      tripIntent.driver._id,
      notification,
      true,
      true
    );
  }

  const driverSocketId = await global.io
    .in(`notifications-${ride.user._id}`)
    .allSockets();

  if (driverSocketId.size > 0 && tripIntent.priceSuggestedBy === 'passenger') {
    tripIntent.message = `${req.user.firstName} suggested another price`;
    for (const socketId of driverSocketId) {
      global.io.to(socketId).emit('suggestAnotherPrice', tripIntent);
    }
  }

  if (driverSocketId.size > 0 && tripIntent.priceSuggestedBy === 'driver') {
    tripIntent.message = `${req.user.firstName} suggested another price`;
    for (const socketId of driverSocketId) {
      global.io.to(socketId).emit('suggestAnotherPrice', tripIntent);
    }
  }


  return res.status(200).json({
    status: 'success',
    data: tripIntent,
  });
});

exports.acceptOrDeclineTripIntent = catchAsync(async (req, res, next) => {
  const tripIntent = await TripIntent.findById(req.params.id)
    .populate('ride')
    .populate({
      path: 'passenger',
      populate: {
        path: 'preferences.preference',
      },
    })
    .populate({
      path: 'driver',
      populate: {
        path: 'preferences.preference',
      },
    });

  if (!tripIntent) {
    return next(new AppError('No trip intent found with that ID', 404));
  }

  const ride = await Ride.findById(tripIntent.ride)
    .populate('user')
    .populate('passengers')
    .select('+isCustom');

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (
    tripIntent.sender === 'passenger' &&
    tripIntent.driver._id.toString() !== req.user._id.toString() &&
    req.body.status !== 'canceled'
  ) {
    return next(
      new AppError('You are not the driver of this trip intent', 400)
    );
  } else if (
    tripIntent.sender === 'driver' &&
    tripIntent.passenger._id.toString() !== req.user._id.toString() &&
    req.body.status !== 'canceled'
  ) {
    return next(
      new AppError('You are not the passenger of this trip intent', 400)
    );
  }

  const status = req.body.status;

  if (tripIntent.status !== 'pending' && status !== 'canceled') {
    const tripIntentStatus = tripIntent.status;
    return next(
      new AppError(
        `This trip intent has already been ${tripIntentStatus}.`,
        400
      )
    );
  }

  if (
    !status ||
    (status !== 'accepted' && status !== 'declined' && status !== 'canceled')
  ) {
    return next(
      new AppError('Status must be accepted , declined or canceled', 400)
    );
  }

  if (status === 'accepted' && ride.passengers.length >= ride.occupants) {
    return next(new AppError('Ride is full', 400));
  }

  if (status === 'accepted') {
    const userInRide = ride.passengers.find(
      (passenger) =>
        passenger.user._id.toString() === tripIntent.passenger._id.toString()
    );
    if (userInRide) {
      return next(new AppError('User is already in this ride', 400));
    }else{
      ride.passengers.push({
        user: tripIntent.passenger._id,
        price: tripIntent.price,
      });
      await ride.save();
    }

    // const customer = await retrieveCustomer(tripIntent.passenger).catch(
    //   (err) => {}
    // );

    // if (!customer) {
    //   return next(new AppError('Passenger has no payment method', 400));
    // }

    // const cardId = customer.default_source;

    // const defaultCard = await retrieveDefaultCard(customer.id, cardId);

    // if (!defaultCard) {
    //   return next(new AppError('Passenger has no payment method', 400));
    // }

    // const paymentIntentData = await paymentIntent(
    //   tripIntent.price,
    //   customer.id,
    //   defaultCard.id
    // ).catch((err) => {});

    // if (!paymentIntentData) {
    //   return next(new AppError('Payment failed', 400));
    // }

    // const paymentIntentId = paymentIntentData.id;

    // tripIntent.paymentIntentId = paymentIntentId;

    // const driverUser = await User.findById(tripIntent.driver._id).select(
    //   '+balance'
    // );

    // const percentage = 0.82;

    // const driverBalance = driverUser.balance;

    // driverUser.balance = driverBalance + tripIntent.price * percentage;

    // await driverUser.save({ validateBeforeSave: false });

    // await tripIntent.save();

    // ride.passengers.push({
    //   user: tripIntent.passenger._id,
    //   price: tripIntent.price,
    // });

    // ride.totalEarnings += tripIntent.price * percentage;

    // await ride.save();

    // if (tripIntent.originalFindRide) {
    //   const originalFindRide = await Ride.findById(tripIntent.originalFindRide);

    //   if (originalFindRide) {
    //     originalFindRide.status = 'accepted';
    //     await originalFindRide.save({ validateBeforeSave: false });
    //   }
    // }
  }

  if (status === 'canceled') {
    if (tripIntent.status !== 'accepted') {
      return next(
        new AppError(
          'Only accepted trip intents can be canceled by the driver',
          400
        )
      );
    }

    // const userInRide = ride.passengers.find(
    //   (passenger) =>
    //     passenger.user._id.toString() === tripIntent.passenger._id.toString()
    // );

    // if (!userInRide) {
    //   return next(new AppError('User is not in this ride', 400));
    // }

    // const rideDate = new Date(ride.date);
    // const now = new Date(Date.now() + 60 * 60 * 1000);
    // const difference = rideDate - now;
    // const hours = Math.floor(difference / 1000 / 60 / 60);

    // if (hours < 2) {
    //   return next(
    //     new AppError(
    //       'You cannot cancel this ride because it is starting within 1 hour',
    //       400
    //     )
    //   );
    // }

    // const customer = await retrieveCustomer(tripIntent.passenger).catch(
    //   (err) => {}
    // );

    // if (!customer) {
    //   return next(new AppError('Error occurred while refunding', 400));
    // }

    // const cardId = customer.default_source;

    // const defaultCard = await retrieveDefaultCard(customer.id, cardId);

    // if (!defaultCard) {
    //   return next(new AppError('Error occurred while refunding', 400));
    // }

    // const refund = await refundPayment(tripIntent.paymentIntentId).catch(
    //   (err) => {}
    // );

    // if (!refund) {
    //   return next(new AppError('Error occurred while refunding', 400));
    // }

    tripIntent.canceledBy = 'passenger';

    // const driverUser = await User.findById(tripIntent.driver._id).select(
    //   '+balance'
    // );

    // const percentage = 0.82;

    // const driverBalance = driverUser.balance;

    // driverUser.balance = driverBalance - tripIntent.price * percentage;

    // await driverUser.save({ validateBeforeSave: false });

    // ride.passengers.pull(userInRide?.user?.toString());

    // ride.totalEarnings -= tripIntent.price * percentage;

    // if (ride?.isCustom) {
    //   ride.status = 'canceled';
    // }

    // await ride.save();
  }

  if (status === 'declined' && ride?.isCustom) {
    await Ride.findByIdAndDelete(ride._id);
  }

  tripIntent.status = status;

  await tripIntent.save();

  const notificationMessage =
    status === 'accepted'
      ? `${ride.user.firstName} has accepted your request`
      : status === 'canceled'
        ? `${ride.user.firstName} has canceled your request`
        : `${ride.user.firstName} has declined your request`;

  const notification = await Notification.create({
    title: 'Request for Joining Trip',
    description: `${notificationMessage}`,
    sender: tripIntent.driver._id,
    receiver: tripIntent.passenger._id,
  });

  const userToNotify = await User.findById(tripIntent.passenger._id).select(
    'settings'
  );
  if (
    userToNotify?.settings?.notifications &&
    userToNotify?.settings?.requests
  ) {
    await sendRealTimeNotification(
      tripIntent.passenger._id,
      notification,
      true,
      true
    );
  }
  tripIntent.message = notificationMessage;

  if (tripIntent.passenger._id.toString() === req.user._id.toString()) {
    const driverSocketId = await global.io
      .in(`notifications-${tripIntent.driver._id}`)
      .allSockets();
      console.log('point 1');

    if (driverSocketId.size > 0) {
      for (const socketId of driverSocketId) {
        global.io.to(socketId).emit('acceptOrDeclineTripIntent', tripIntent);
      }
    }
  } else if (tripIntent.driver._id.toString() === req.user._id.toString()) {
    const passengerSocketId = await global.io
      .in(`notifications-${tripIntent.passenger._id}`)
      .allSockets();
      console.log('point 2');

    if (passengerSocketId.size > 0) {
      for (const socketId of passengerSocketId) {
        global.io.to(socketId).emit('acceptOrDeclineTripIntent', tripIntent);
      }
    }
  }
  console.log('point 3');
  


  return res.status(200).json({
    status: 'success',
    data: tripIntent,
  });
});


exports.payForTripIntent = catchAsync(async (req, res, next) => {
  const tripIntent = await TripIntent.findById(req.params.id)
    .populate('ride')
    .populate({
      path: 'passenger',
      populate: {
        path: 'preferences.preference',
      },
    })
    .populate({
      path: 'driver',
      populate: {
        path: 'preferences.preference',
      },
    });

  if (!tripIntent) {
    return next(new AppError('No trip intent found with that ID', 404));
  }

  const ride = await Ride.findById(tripIntent.ride)
    .populate('user')
    .populate('passengers')

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (tripIntent.status !== 'accepted') {
    const tripIntentStatus = tripIntent.status;
    return next(
      new AppError(
        `You cannot pay for a trip that is ${tripIntentStatus}.`,
        400
      )
    );
  }



  if (ride.passengers.length >= ride.occupants) {
    return next(new AppError('Ride is full', 400));
  }
  const customer = await retrieveCustomer(tripIntent.passenger).catch(
    (err) => { }
  );

  if (!customer) {
    return next(new AppError('Error occurred while retrieving customer', 400));
  }
  if (!req.body.cardId) {
    return next(new AppError('Missing cardId', 400));
  }
  // payment intent

  const paymentIntentData = await paymentIntent(tripIntent.price, customer.id, req.body.cardId)


  if (!paymentIntentData) {
    return next(new AppError('Payment failed', 400));
  }

  const paymentIntentId = paymentIntentData.id;

  tripIntent.paymentIntentId = paymentIntentId;

  const driverUser = await User.findById(tripIntent.driver._id).select(
    '+pendingAmount'
  );
  const applicationFee = calculateApplicationFee(tripIntent.price)
  driverUser.pendingAmount += tripIntent.price - applicationFee

  await driverUser.save({ validateBeforeSave: false });

  await tripIntent.save();

  ride.passengers.push({
    user: tripIntent.passenger._id,
    price: tripIntent.price,
  });

  ride.totalEarnings += tripIntent.price - applicationFee;

  await ride.save();


  const notificationMessage = `${req.user.firstName} shares your trip`

  const notification = await Notification.create({
    title: 'Passenger Joined to your Trip',
    description: `${notificationMessage}`,
    sender: tripIntent.passenger._id,
    receiver: tripIntent.driver._id,
  });

  const userToNotify = await User.findById(tripIntent.driver._id).select(
    'settings'
  );
  if (
    userToNotify?.settings?.notifications &&
    userToNotify?.settings?.requests
  ) {
    await sendRealTimeNotification(
      tripIntent.driver._id,
      notification,
      true,
      true
    );
  }
  tripIntent.message = notificationMessage;

  if (tripIntent.passenger._id.toString() === req.user._id.toString()) {
    const driverSocketId = await global.io
      .in(`notifications-${tripIntent.driver._id}`)
      .allSockets();

    if (driverSocketId.size > 0) {
      for (const socketId of driverSocketId) {
        global.io.to(socketId).emit('passengerJoined', tripIntent);
      }
    }
  }

  return res.status(200).json({
    status: 'success',
    data: paymentIntentData,
  });
});


exports.getTripIntentsByRide = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    TripIntent.find({
      $or: [
        {
          ride: req.params.id,
          sender: 'passenger',
          driver: req.user._id,
        },
        {
          originalFindRide: req.params.id,
          sender: 'driver',
          passenger: req.user._id,
        },
      ],
      status: "pending",
    }).select('-startingPoint -destination -createdAt'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const tripIntents = await features.query
    .populate({
      path: 'passenger',
      select: '-preferences -createdAt -updatedAt -__v',
    })
    .populate({
      path: 'ride',
      populate: {
        path: 'passengers.user',
        select: '-preferences -createdAt -updatedAt -__v',
      },
    })
    .populate({
      path: 'driver',
      select: '-preferences -createdAt -updatedAt -__v',
    });

  return res.status(200).json({
    status: 'success',
    results: tripIntents.length,
    data: tripIntents,
  });
});

exports.getTripIntentsByUsers = catchAsync(async (req, res, next) => {
 
  const userId = new Types.ObjectId(req.user.id);
  const tripIntents = await TripIntent.aggregate([
    {
      $addFields: {
        endDate: { $toDate: "$endDate" }, // Convert endDate string to Date object
      }
    },
    {
      $match: {
        endDate: { $gt: currentDate },
        $or: [
          
          { passenger: { $eq: userId } }
        ],
        status: { $nin: ['completed', 'canceled'] },
        paymentIntentId: { $exists: false },
      }
    },
    {
      $lookup: {
        from: "rides",
        localField: "ride",
        foreignField: "_id",
        as: "ride",
      }
    },
    {
      $unwind: {
        path: "$ride",
        preserveNullAndEmptyArrays: true,
      }
    },
    {
      $lookup: {
        from: "cars",
        localField: "ride.car",
        foreignField: "_id",
        as: "carDetails",
      }
    },
    {
      $unwind: {
        path: "$carDetails",
        preserveNullAndEmptyArrays: true,
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "ride.driver", // Verify if it's ride.driver or ride.passenger you want
        foreignField: "_id",
        as: "userDetails"
      }
    },
    {
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        date: "$ride.date",
        passenger: 1,
        driver: 1,
        price: 1,
        priceSuggestedBy: 1,
        status: 1,
        sender: 1,
        endDate: 1,
        createdAt: 1,
        updatedAt: 1,
        __v: 1,
        startingPoint: { name: "$ride.startingPoint.name" },
        destination: { name: "$ride.destination.name" },
        user: {
          firstName: "$userDetails.firstName",
          email: "$userDetails.email",
          lastName: "$userDetails.lastName",
          photo: "$userDetails.photo",
        },
        car: {
          brand: "$carDetails.brand",
          model: "$carDetails.model",
          color: "$carDetails.color",
        },
      }
    }
  ]);


  return res.status(200).json({
    status: 'success',
    results: tripIntents.length,
    data: tripIntents,
  });
});

exports.addToRide = catchAsync(async (req, res, next) => {
  const ride = await Ride.findById(req.params.findRideId)
    .populate('user')
    .populate('passengers');

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (ride.mode !== 'find_a_ride') {
    return next(new AppError('This trip is not for finding a ride!', 400));
  }

  if (!req.body.price) {
    return next(new AppError('Price is required', 400));
  }

  if (req.params.addToRideId) {
    const foundRide = await Ride.findById(req.params.addToRideId);

    if (!foundRide) {
      return next(new AppError('No ride found with that ID', 404));
    }

    if (foundRide.mode !== 'add_a_ride') {
      return next(new AppError('This trip is not for adding a ride!', 400));
    }

    if (foundRide.user._id.toString() !== req.user._id.toString()) {
      return next(new AppError('You are not the driver of this ride', 400));
    }

    if (foundRide.passengers.length >= foundRide.occupants) {
      return next(new AppError('Ride is full', 400));
    }

    const userInRide = foundRide.passengers.find(
      (passenger) => passenger.user._id.toString() === ride.user._id.toString()
    );

    if (userInRide) {
      return next(new AppError('User is already in this ride', 400));
    }

    const tripIntentExists = await TripIntent.findOne({
      ride: foundRide._id,
      passenger: ride.user._id,
      status: { $nin: ['canceled', 'declined'] },
      originalFindRide: ride._id,
    });

    if (tripIntentExists) {
      return next(
        new AppError(
          'User has already joined this ride. Please wait for the passenger to confirm your request.',
          400
        )
      );
    }

    const tripIntent = await TripIntent.create({
      ride: foundRide._id,
      passenger: ride.user._id,
      driver: foundRide.user._id,
      price: req.body.price,
      startingPoint: foundRide.startingPoint,
      destination: foundRide.destination,
      sender: 'driver',
      originalFindRide: ride._id,
    });

    const notification = await Notification.create({
      title: 'A Driver would like you to join his trip',
      description: `${ride.user.firstName} would like you to join his trip`,
      sender: tripIntent.passenger._id,
      receiver: tripIntent.driver._id,
    });

    const userToNotify = await User.findById(tripIntent.driver._id).select(
      'settings'
    );
    if (
      userToNotify?.settings?.notifications &&
      userToNotify?.settings?.requests
    ) {
      await sendRealTimeNotification(
        tripIntent.driver._id,
        notification,
        true,
        true
      );
    }

    const passengerSocketId = await global.io
      .in(`notifications-${tripIntent.passenger._id}`)
      .allSockets();

    if (passengerSocketId.size > 0) {
      tripIntent.message = `${ride.user.firstName} would like you to join his trip`;
      for (const socketId of passengerSocketId) {
        global.io.to(socketId).emit('joinRide', tripIntent);
      }
    }

    return res.status(200).json({
      status: 'success',
      data: tripIntent,
    });
  } else {
    let totalDuration = 0;
    let totalDistance = 0;
    let startingPoint = ride?.startingPoint;
    let destination = ride?.destination;

    const { duration, distance } = await calculateDurationAndDistance(
      startingPoint?.geometry?.location?.lat,
      startingPoint?.geometry?.location?.lng,
      destination?.geometry?.location?.lat,
      destination?.geometry?.location?.lng
    );

    if (duration > 0 && distance > 0) {
      totalDuration += duration;
      totalDistance += distance;
    }

    const newRide = await Ride.create({
      user: req.user._id,
      mode: 'add_a_ride',
      price: req.body.price,
      startingPoint: ride.startingPoint,
      destination: ride.destination,
      date: ride.date,
      occupants: 1,
      duration: totalDuration,
      distance: totalDistance,
      isCustom: true,
    });

    const tripIntent = await TripIntent.create({
      ride: newRide._id,
      passenger: ride.user._id,
      driver: req.user._id,
      price: req.body.price,
      startingPoint: ride.startingPoint,
      destination: ride.destination,
      sender: 'driver',
      originalFindRide: ride._id,
    });

    const notification = await Notification.create({
      title: 'A Driver would like you to join his trip',
      description: `${req.user.firstName} would like you to join his trip`,
      sender: tripIntent.driver._id,
      receiver: tripIntent.passenger._id,
    });

    const userToNotify = await User.findById(tripIntent.driver._id).select(
      'settings'
    );
    if (
      userToNotify?.settings?.notifications &&
      userToNotify?.settings?.requests
    ) {
      await sendRealTimeNotification(
        tripIntent.driver._id,
        notification,
        true,
        true
      );
    }

    const passengerSocketId = await global.io
      .in(`notifications-${ride.user._id}`)
      .allSockets();

    if (passengerSocketId.size > 0) {
      tripIntent.message = `${req.user.firstName} would like you to join his trip`;
      for (const socketId of passengerSocketId) {
        global.io.to(socketId).emit('joinRide', tripIntent);
      }
    }

    return res.status(200).json({
      status: 'success',
      data: tripIntent,
    });
  }
});

exports.deleteTripIntent = catchAsync(async (req,res,next)=>{
  const tripIntent = await TripIntent.findById(req.params.id);
  if (!tripIntent) {
    return next(new AppError('No ride found with that ID', 404));
  }

  
  const isPassenger = tripIntent.user._id.toString() === req.user.id.toString();


  if (!isPassenger) {
    return next(
      new AppError('You are not authorized to delete this ride', 403)
    );
  }
  TripIntent.findAndDeleteById(req.params.id);

  return res.status(200).json({
    status: 'success',
    data: null,
  });

});

//TODO: add cancel trip intent by passenger or driver and add auto refund to passenger
