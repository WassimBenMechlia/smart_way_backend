const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const Ride = require('../models/ride.model');
const User = require('../models/user.model');
const Car = require('../models/car.model');
/* const stripeSk = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripePk = require('stripe')(process.env.STRIPE_PUBLIC_KEY); */
const {
  inCircle,
  sendRealTimeNotification,
  searchRidesDependingOnStartAndEndLocation,
  calculateDurationAndDistance,
  calculateTotalDistanceAndDuration,
  calculateGasolineCost,
  calculateTimeCost,
  calculateDayNightCost,
  retrieveCustomer,
  retrieveDefaultCard,
  paymentIntent,
  refundPayment,
  checkUserHasCard,
} = require('../utils/sharedFunctions');
const pointSchema = require('../models/point.model');
const moment = require('moment-timezone');
const TripIntent = require('../models/trip_intent.model');
const Chat = require('../models/chat.model');
const Message = require('../models/message.model');
const Notification = require('../models/notification.model');
const Preference = require('../models/preference.model');
exports.createRide = catchAsync(async (req, res, next) => {
  const data = { ...req.body };

  
  if (data.mode === 'add_a_ride') {
    if (!data.occupants || data.occupants < 1 || data.occupants > 4) {
      return next(
        new AppError('Please provide the number of occupants (1-4)', 400)
      );
    }
    if (!data.price) {
      return next(new AppError('Please provide the price', 400));
    }
  }
  let totalDuration = 0;
  let totalDistance = 0;

  let startingPoint = data?.startingPoint;
  let destination = null;



  destination = data?.destination;

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

  data.duration = totalDuration;
  data.distance = totalDistance;

  if (data?.mode === 'add_a_ride') {
    if (data?.car) {
      const car = await Car.findById(data.car);
      if (!car) return next(new AppError('No car found with that ID', 404));
      if (car?.user?._id?.toString() !== req?.user?.id?.toString())
        return next(
          new AppError('You are not authorized to use this car', 403)
        );

      data.car = car._id;
    } else {
      data.car = req.user.defaultCar;
    }
  } else {
    data.car = null;
  }

  const newRide = await Ride.create({
    ...data,
    user: req.user.id,
  });

  const createdRide = await Ride.findById(newRide._id).populate({
    path: 'user',
  });

  res.status(201).json({
    status: 'success',
    data: createdRide,
  });
});

exports.calculatePrice = catchAsync(async (req, res, next) => {
  const data = { ...req.body };

  let places = [];

  if (data?.ride) {
    const ride = await Ride.findById(data?.ride);

    if (!ride) return next(new AppError('No ride found with that ID'));

    places = [ride.startingPoint, ...ride.extraPlaces, ride.destination];
    data.date = ride?.date;
  } else {
    places = data?.places;
  }
  if (places.length < 2)
    return next(new AppError('Please provide more than 1 place', 400));

  const { distance, duration } = await calculateTotalDistanceAndDuration(
    places
  );
  

  /* const gasolineCost = calculateGasolineCost(distance);
  const timeCost = calculateTimeCost(duration);
  const dayNightCost = calculateDayNightCost(data.date); */
  // const totalPrice =   Number((gasolineCost + timeCost + dayNightCost)?.toFixed(2)) || 0;
  const totalPrice = distance * 0.045 

  return res.status(200).json({
    status: 'success',
    price: totalPrice,
  });
});

exports.getAllRides = catchAsync(async (req, res, next) => {
  let query = {
    // status: { $nin: ['completed', 'canceled', 'accepted'] }, //TODO: check this
    status: { $nin: ['canceled', 'completed'] },
    $or: [{ user: req.user.id }, { 'passengers.user': req.user.id }],
  };

  if (req?.query?.mode === 'find_a_ride') {
    delete req.query.mode;
    // query = {
    //   mode: 'find_a_ride',
    //   status: { $nin: ['completed', 'canceled', 'accepted'] },
    //   $or: [{ user: req.user.id }, { 'passengers.user': req.user.id }],
    // };
    query = {
      // status: { $nin: ['completed', 'canceled', 'accepted'] }, //TODO: check this
      status: { $nin: ['canceled', 'completed'] },
      $or: [
        {
          mode: 'find_a_ride',
          $or: [{ user: req.user.id }, { 'passengers.user': req.user.id }],
        },
        {
          mode: 'add_a_ride',
          'passengers.user': req.user.id,
        },
      ],
    };
  } else if (req?.query?.mode === 'add_a_ride') {
    delete req.query.mode;
    query = {
      mode: 'add_a_ride',
      // status: { $nin: ['completed', 'canceled', 'accepted'] }, //TODO: check this
      status: { $nin: ['canceled', 'completed'] },
      user: req.user.id,
    };
  }

  const features = new APIFeatures(
    Ride.find(query).populate({
      path: 'passengers.user',
      select: 'firstName lastName email phone photo',
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const rides = await features.query;

  for (let i = 0; i < rides?.length; i++) {
    if (rides?.[i]?.user?._id?.toString() !== req?.user?.id?.toString()) {
      const passenger = rides?.[i]?.passengers?.find((passenger) => {
        return passenger?.user?._id?.toString() === req?.user?.id?.toString();
      });

      rides[i].totalEarnings = passenger?.price || rides?.[i]?.price;
    }
  }

  return res.status(200).json({
    status: 'success',
    results: rides.length,
    data: rides,
  });
});

/* exports.getRidesRating = catchAsync(async (req, res, next) => {

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('No user found with that ID', 404));  
  } 


  const ridesPublished =  await Ride.aggregate([
    {
      $match: {
        user: user._id,
        status: "completed",
        "passengers.ratingComment": { $exists: true }
      }
    },
    {
      $project: {
        _id: 0,
        passengers: 1
      }
    },
    {
      $unwind: "$passengers"
    },
    {
      $lookup: {
        from: "users",
        localField: "passengers.user",
        foreignField: "_id",
        as: "passengerUser"
      }
    },
    {
      $unwind: "$passengerUser"
    },
    {
      $project: {
        "rating":"$passengers.rating",
        "comment":"$passengers.ratingComment.text",
        "date": "$passengers.ratingComment.createdAt",
        "firstName":"$passengerUser.firstName",
        "lastName":"$passengerUser.lastName",
        "photo":"$passengerUser.photo"
      }
    }
  ])

  return res.status(200).json({
    status: 'success',
    results: ridesPublished.length,
    data: ridesPublished,
  });
}); */

exports.createChatForRide = catchAsync(async (req, res, next) => {
  const { rideId } = req.params;

  const ride = await Ride.findById(rideId);

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (ride?.user?._id?.toString() === req?.user?.id?.toString()) {
    return next(new AppError('You cannot chat with yourself', 400));
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

  return res.status(201).json({
    status: 'success',
    data: chat,
  });
}); 

 exports.getRide = catchAsync(async (req, res, next) => {
  const ride = await Ride.findById(req.params.id)
    .populate({
      path: 'user',
    })
    .populate({
      path: 'passengers.user',
      populate: {
        path: 'preferences.preference',
      },
    });

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  const preferences = ride.user.preferences.filter((preference) => {
    return preference.isAllowed;
  });

  ride.user.preferences = preferences;

  res.status(200).json({
    status: 'success',
    data: ride,
  });
});


exports.deleteRide = catchAsync(async (req, res, next) => {
  const ride = await Ride.findById(req.params.id).select('+isCustom');
  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  const isDriver = ride.user._id.toString() === req.user.id.toString();

  const isPassenger = ride.passengers.some((passenger) => {
    return passenger.user._id.toString() === req.user.id.toString();
  });

  if (!isDriver && !isPassenger) {
    return next(
      new AppError('You are not authorized to delete this ride', 403)
    );
  }

  if (ride.status === 'live') {
    return next(new AppError('You cannot cancel a live ride', 400));
  }

  // const rideDate = new Date(ride.date);
  // const now = new Date(Date.now() + 60 * 60 * 1000);
  // const difference = rideDate - now;
  // const hours = Math.floor(difference / 1000 / 60 / 60);

  // if (hours < 2) {
  //   return next(
  //     new AppError(
  //       'You cannot cancel this ride because it is starting within 2 hours',
  //       400
  //     )
  //   );
  // }

  if (isPassenger) {
    const tripIntent = await TripIntent.findOne({
      ride: ride._id,
      passenger: req.user.id,
      status: { $nin: ['completed', 'canceled', 'declined'] },
    })
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

    const userInRide = ride.passengers.find(
      (passenger) =>
        passenger.user._id.toString() === tripIntent.passenger._id.toString()
    );

    if (!userInRide) {
      return next(new AppError('User is not in this ride', 400));
    }

    tripIntent.status = 'canceled';

    

    tripIntent.canceledBy = 'passenger';


    
    await tripIntent.save({ validateBeforeSave: false });

    const notification = await Notification.create({
      title: 'Passenger Canceled',
      description: `The passenger ${tripIntent.passenger.firstName} ${tripIntent.passenger.lastName} has canceled his trip`,
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
      .in(`notifications-${tripIntent.driver._id}`)
      .allSockets();

    if (driverSocketId.size > 0) {
      for (const socketId of driverSocketId) {
        global.io.to(socketId).emit('deletedRide', tripIntent);
      }
    }

    if (ride?.isCustom) {
      ride.status = 'canceled';
      await ride.save();
    }

    return res.status(204).json({
      status: 'success',
      data: null,
    });
  } else {
    ride.active = false;
    ride.status = 'canceled';
    ride.totalEarnings = 0;

    await ride.save();

    const tripIntents = await TripIntent.find({
      ride: ride._id,
      status: { $nin: ['completed', 'canceled', 'declined'] },
    })
      .populate('passenger')
      .populate('driver');

    const driverUser = await User.findById(ride.user._id).select('+balance');

   

    tripIntents.forEach(async (tripIntent) => {
      tripIntent.status = 'canceled';
      tripIntent.canceledBy = 'driver';
      await tripIntent.save({ validateBeforeSave: false });

      const notification = await Notification.create({
        title: 'Ride Canceled',
        description: `The ride you requested has been canceled by the driver`,
        sender: ride.user._id,
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

      const passengerSocketId = await global.io
        .in(`notifications-${tripIntent.passenger._id}`)
        .allSockets();

      if (passengerSocketId.size > 0) {
        for (const socketId of passengerSocketId) {
          global.io.to(socketId).emit('deletedRide', tripIntent);
        }
      }

      

     
    });

 
    await driverUser.save({ validateBeforeSave: false });

    return res.status(204).json({
      status: 'success',
      data: null,
    });
  }
});

exports.searchRides = catchAsync(async (req, res, next) => {
  const { startingPoint, destination, occupants, date } = req.body;

  const userStartLatLon = {
    lat: startingPoint?.geometry?.location?.lat,
    lng: startingPoint?.geometry?.location?.lng,
  };

  const userEndLatLon = {
    lat: destination?.geometry?.location?.lat,
    lng: destination?.geometry?.location?.lng,
  };

  const mode = req.query.mode || 'add_a_ride';

  const query = {
    mode,
    active: true,
    status: { $in: ['pending', 'live'] },
    // status: "pending",
    occupants: { $gte: occupants },
    user: { $ne: req.user.id },
  };
  /* if (date) {
    query.date = {
      $gte: moment(date).tz('Africa/Tunis').startOf('day').format(),
      $lte: moment(date).tz('Africa/Tunis').endOf('day').format(),
    };
  } */

  const filteredRides = await searchRidesDependingOnStartAndEndLocation(
    userStartLatLon,
    userEndLatLon,
    query
  );
  //console.log("filtered rides "+filteredRides);

  
  const sanitizedRides = filteredRides.map(ride => {
    console.log(`user ${ride}`);
    const sanitizedUser = {
      firstName: ride.user.firstName,
      lastName: ride.user.lastName,
      email: ride.user.email,
      phone: ride.user.phone,
      photo: ride.user.photo,
      preferences: ride.user.preferences
    };
    return {
      ...ride.toObject(),
      user: sanitizedUser
    };
  });

  return res.status(200).json({
    status: 'success',
    results: sanitizedRides.length,
    data: sanitizedRides,
  });
}); 
/* exports.checkExistingRide = catchAsync(async (req, res, next) => {
  const modeFindRide = await Ride.findById(req.params.rideId);

  if (!modeFindRide) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (modeFindRide.mode !== 'find_a_ride') {
    return next(new AppError('This trip is not for finding a ride!', 400));
  }

  const userStartLatLon = {
    lat: modeFindRide.startingPoint.geometry.location.lat,
    lng: modeFindRide.startingPoint.geometry.location.lng,
  };

  const userEndLatLon = {
    lat: modeFindRide.destination.geometry.location.lat,
    lng: modeFindRide.destination.geometry.location.lng,
  };

  const query = {
    user: req.user.id,
    mode: 'add_a_ride',
    active: true,
    status: { $in: ['pending', 'live'] },
  };

  const filteredRides = await searchRidesDependingOnStartAndEndLocation(
    userStartLatLon,
    userEndLatLon,
    query,
    1000
  );

  // const rideToReturn = filteredRides?.length > 0 ? filteredRides[0] : null;

  const rideToReturn = filteredRides.find((ride) => {
    return (
      ride.passengers.length < ride.occupants
      //  &&
      // !ride.passengers.some((passenger) => {
      //   return passenger.user._id.toString() === req.user.id.toString();
      // })
    );
  });

  return res.status(200).json({
    status: 'success',
    data: rideToReturn,
  });
}); */

/* exports.rateRide = catchAsync(async (req, res, next) => {
  const { rating, ratingComment } = req.body;

  const ride = await Ride.findById(req.params.rideId);

  if (!ride) {
    return next(new AppError('No ride found with that ID', 404));
  }

  if (ride.user.toString() === req.user.id.toString()) {
    return next(new AppError('You cannot rate your own ride', 400));
  }

  const passenger = ride.passengers.find((passenger) => {
    return passenger.user.toString() === req.user.id.toString();
  });

  if (!passenger) {
    return next(new AppError('You are not a passenger of this ride', 400));
  }

  if (passenger.rating) {
    return next(new AppError('You have already rated this ride', 400));
  }

  passenger.rating = rating;
  passenger.ratingComment.text = ratingComment;
  passenger.ratingComment.createdAt = new Date() 
  await ride.save({ validateBeforeSave: false });

  let ratingAverage = 0;

  for (let i = 0; i < ride.passengers.length; i++) {
    if (ride.passengers[i].rating) {
      ratingAverage += ride.passengers[i].rating;
    }
  }

  const passengersLengthExceptZero = ride.passengers.filter((passenger) => {
    return passenger.rating;
  }).length;

  ratingAverage = ratingAverage / passengersLengthExceptZero || 0;

  ride.ratingAverage = ratingAverage;

  await ride.save({ validateBeforeSave: false });

  const user = await User.findById(ride.user._id);

  const userRides = await Ride.find({
    user: ride.user._id,
    status: { $in: ['completed', 'live'] },
  });

  let ratingAverageForUser = 0;

  for (let i = 0; i < userRides.length; i++) {
    if (userRides[i].ratingAverage) {
      ratingAverageForUser += userRides[i].ratingAverage;
    }
  }

  const userRidesLengthExceptZero = userRides.filter((userRide) => {
    return userRide.ratingAverage;
  }).length;

  ratingAverageForUser = ratingAverageForUser / userRidesLengthExceptZero || 0;

  user.ratingAverage = ratingAverageForUser;

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: ride,
  });
}); */

exports.ridesHistory = catchAsync(async (req, res, next) => {
  const query = {
    $or: [{ user: req.user.id }, { 'passengers.user': req.user.id }],
    status: { $in: ['completed', 'canceled'] },
  };

  const dateFilter = req.query.dateFilter;

  if (dateFilter) {
    switch (dateFilter) {
      case 'month':
        query.date = {
          $gte: moment().startOf('month').format(),
          $lte: moment().endOf('month').format(),
        };
        break;
      case 'week':
        query.date = {
          $gte: moment().startOf('week').format(),
          $lte: moment().endOf('week').format(),
        };
        break;
    }
    delete req.query.dateFilter;
  }

  const features = new APIFeatures(
    Ride.find(query).populate({
      path: 'passengers.user',
      select: 'firstName lastName email phone photo',
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const rides = await features.query;
  const ridesAsOccupant = []
  const ridesAsDriver = []
  for (const ride of rides) {
    if (ride.user.id === req.user.id) {
      ridesAsDriver.push(ride)
    } else {
      ridesAsOccupant.push(ride)
    }
  }
    console.log({rides});
  return res.status(200).json({
    status: 'success',
    results: rides.length,
    data: {ridesAsDriver, ridesAsOccupant},
  });
});
