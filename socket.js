const User = require('./src/models/user.model');
const AppError = require('./src/utils/appError');
const jwt = require('jsonwebtoken');
const Chat = require('./src/models/chat.model');
const moment = require('moment-timezone');
const Notification = require('./src/models/notification.model');
const { sendRealTimeNotification } = require('./src/utils/sharedFunctions');
const TripIntent = require('./src/models/trip_intent.model');
const Ride = require('./src/models/ride.model');
const dotenv = require('dotenv');
const {
  inCircle,
  calculateDurationAndDistance,
} = require('./src/utils/sharedFunctions');

dotenv.config({ path: './.env' });
 const socketMiddleware = async (socket, next) => {
   try {

     const token = socket.handshake.query.token;

    if (!token) {
      next(new AppError('Token not found', 404));
      return;
    }
     console.log(`toekn ${token}`);
     const auth = await jwt.verify(token, process.env.JWT_SECRET);
     const user = await User.findById(auth.id);

     if (user) {
       socket.user = user;
       next();
     } else {
       next(new AppError('User not found', 403));
     }
   } catch (err) {
     next(new AppError('Provide JWT', 403));
     // console.log('socket connection error : ', err);
   }
 };
  

const socketGateway = (socket, io) => {
  socket.on("new",async(message)=>{
    console.log(message);
  });
  socket.on('joinChats', async (userChats) => {
    console.log(`user chat id${userChats} length : ${userChats.length}`);
    console.log("im here ya john ");
    try {
      var chatsId = userChats.chatsId;
      
      if (!chatsId) {
        socket.emit('error', 'No chats provided');
        return;
      }

      const user = socket.user;
      const chats = await Chat.find({ _id: { $in: chatsId } });

      if (chats.length !== chatsId.length) {
        chatsId = chatsId.filter((chatId) =>
          chats.map((chat) => chat.id).includes(chatId)
        );

        if (chatsId.length === 0) {
          socket.emit('error', 'All chats does not exist');
          return;
        }
        // socket.emit('error', 'One or more chats does not exist');
      }

      const usersInChats = chats.map((chat) =>
        chat.users.map((user) => user.id)
      );

      const userInAllChats = usersInChats.every((users) =>
        users.includes(user.id)
      );

      if (!userInAllChats) {
        const chatNotBelongToUser = chats.filter((chat) => {
          return chat.users.map((user) => user.id).includes(user.id);
        });

        chatsId = chatsId.filter((chatId) =>
          chatNotBelongToUser.map((chat) => chat.id).includes(chatId)
        );

        if (chatsId.length === 0) {
          socket.emit('error', 'You are not in any of the chats');
          return;
        }

        // socket.emit('error', 'You are not in one or more chats');
      }

      chatsId.forEach((chatId) => {
        // console.log(
        //   `user ${socket.user.firstName} ${socket.user.lastName} joined chat ${chatId}`
        // );
        socket.join(`chat-${chatId}`);
        console.log("user joined chat ");
      });
    } catch (err) {
      console.log('error in join chat ' + err);
    }
  });

  socket.on('leaveChats', async (userChats) => {
    try {
      var chatsId = userChats.chatsId;

      // console.log('chatsId', chatsId);

      if (!chatsId) {
        socket.emit('error', 'No chats provided');
        return;
      }

      const user = socket.user;
      const chats = await Chat.find({ _id: { $in: chatsId } });

      if (chats.length !== chatsId.length) {
        chatsId = chatsId.filter((chatId) =>
          chats.map((chat) => chat.id).includes(chatId)
        );

        if (chatsId.length === 0) {
          socket.emit('error', 'All chats does not exist');
          return;
        }

        // socket.emit('error', 'One or more chats does not exist');
      }

      const usersInChats = chats.map((chat) =>
        chat.users.map((user) => user.id)
      );

      const userInAllChats = usersInChats.every((users) =>
        users.includes(user.id)
      );

      if (!userInAllChats) {
        const chatNotBelongToUser = chats.filter((chat) => {
          return chat.users.map((user) => user.id).includes(user.id);
        });

        chatsId = chatsId.filter((chatId) =>
          chatNotBelongToUser.map((chat) => chat.id).includes(chatId)
        );

        if (chatsId.length === 0) {
          socket.emit('error', 'You are not in any of the chats');
          return;
        }

        // socket.emit('error', 'You are not in one or more chats');
      }

      chatsId.forEach((chatId) => {
        // console.log(
        //   `user ${socket.user.firstName} ${socket.user.lastName} left chat ${chatId}`
        // );
        socket.leave(`chat-${chatId}`);
      });
    } catch (err) {
      console.log('error in leave chat');
    }
  });

  socket.on('disconnect', async () => {
    try {
      const user = await User.findById(socket.user.id);

      if (!user) {
        return;
      }

      const now = moment().tz('Europe/Paris');

      now.add(1, 'hours');

      if (user.seenAt) {
        user.seenAt = now.toDate();
      }

      // if (user.deviceIds && user.deviceIds.length > 0) {
      //   user.deviceIds = [];
      // }

      await user.save({ validateBeforeSave: false });

      console.log(`user ${user.firstName} ${user.lastName} disconnected`);
    } catch (err) {
      console.log('error in disconnect');
    }
  });

  socket.on('locationChanged', async (data) => {
    const rideId = data.rideId;
    const location = data.location;

    if (!rideId) {
      return;
    }

    const ride = await Ride.findById(rideId).populate('user');

    if (!ride) {
      return;
    }

    const currentUser = await User.findById(socket.user.id);

    if (!currentUser) {
      return;
    }

    currentUser.location = location;

    await currentUser.save({ validateBeforeSave: false });

    if (ride.status !== 'live') {
      const currentUserSocketId = await global.io
        .in(`notifications-${socket.user.id}`)
        .allSockets();

      if (currentUserSocketId.size > 0) {
        for (const socketId of currentUserSocketId) {
          global.io.to(socketId).emit('updatedLocation', [currentUser]);
        }
      }

      if (
        ride.status === 'completed' &&
        ride.user._id.toString() === currentUser._id.toString()
      ) {
        const usersToEmitToDriver = [];

        for (const passenger of ride.passengers) {
          const passengerUser = await User.findById(passenger.user);

          const copyPassenger = { ...passengerUser._doc };

          copyPassenger.status = passenger.status || null;
          copyPassenger.rating = passenger.rating || null;

          usersToEmitToDriver.push(copyPassenger);
        }

        // socket.emit('tripEnd', {
        //   users: usersToEmitToDriver,
        //   totalEarnings: ride.totalEarnings,
        // });
      }
      return;
    }

    const tripIntents = await TripIntent.find({
      $or: [{ ride: ride._id }, { originalFindRide: ride._id }],
      status: { $nin: ['completed', 'canceled', 'declined'] },
      driver: ride.user._id,
      passenger: { $in: ride.passengers.map((passenger) => passenger.user) },
    })
      .populate('passenger')
      .populate('driver')
      .populate('ride');

    if (!tripIntents || tripIntents.length === 0) {
      return;
    }

    const usersIds = [
      ride.user._id.toString(),
      ...ride.passengers.map((passenger) => passenger.user.toString()),
    ];

    if (!usersIds.includes(currentUser.id.toString())) {
      return;
    }

    const index = usersIds.indexOf(currentUser.id.toString());

    if (index > -1) {
      usersIds.splice(index, 1);
    }

    const users = await User.find({ _id: { $in: usersIds } });

    if (currentUser._id.toString() !== ride.user._id.toString()) {
      const passenger = ride.passengers.find(
        (passenger) => passenger.user.toString() === currentUser.id.toString()
      );

      if (!passenger) {
        return;
      }

      const tripIntent = tripIntents.find(
        (tripIntent) =>
          tripIntent.passenger._id.toString() === passenger.user.toString()
      );

      if (!tripIntent) {
        return;
      }

      if (passenger.status === 'on-the-way') {
        const passengerArrivedToDestination = inCircle(
          currentUser.location.latitude,
          currentUser.location.longitude,
          tripIntent.destination.latitude,
          tripIntent.destination.longitude,
          20
        );

        if (passengerArrivedToDestination) {
          passenger.status = 'arrived';

          await ride.save({ validateBeforeSave: false });

          tripIntent.status = 'completed';

          const now = moment().tz('Africa/Tunis').format();

          await TripIntent.findByIdAndUpdate(
            tripIntent._id,
            (endDate = now),
            { status: 'completed' },
            { validateBeforeSave: false }
          );

          if (tripIntent?.originalFindRide) {
            const originalFindRide = await Ride.findById(
              tripIntent.originalFindRide
            );

            if (originalFindRide) {
              originalFindRide.status = 'completed';
            }
          }
        }
      }
    } else {
      const currentRidePassengers = await User.find({
        _id: { $in: ride.passengers.map((passenger) => passenger.user) },
      });

      for (const userPassenger of currentRidePassengers) {
        const passenger = ride.passengers.find(
          (passenger) =>
            passenger.user.toString() === userPassenger.id.toString()
        );

        if (
          passenger &&
          (passenger.status === 'waiting' || passenger.status === 'pending')
        ) {
          const driverArrivedToPassenger = inCircle(
            userPassenger.location.latitude,
            userPassenger.location.longitude,
            ride.user.location.latitude,
            ride.user.location.longitude,
            20
          );

          if (driverArrivedToPassenger) {
            console.log(
              'driverArrivedToPassenger ' +
                userPassenger.firstName +
                ' : ' +
                driverArrivedToPassenger
            );
            passenger.status = 'on-the-way';

            await ride.save({ validateBeforeSave: false });
          }
        } else if (passenger && passenger.status === 'on-the-way') {
          const tripIntent = tripIntents.find(
            (tripIntent) =>
              tripIntent.passenger._id.toString() ===
              userPassenger.id.toString()
          );

          if (tripIntent) {
            const driverArrivedToPassengerDestination = inCircle(
              currentUser.location.latitude,
              currentUser.location.longitude,
              tripIntent.destination.geometry.location.lat,
              tripIntent.destination.geometry.location.lng,
              20
            );

            const distance = Math.sqrt(
              Math.pow(
                currentUser.location.latitude -
                  tripIntent.destination.geometry.location.lat,
                2
              ) +
                Math.pow(
                  currentUser.location.longitude -
                    tripIntent.destination.geometry.location.lng,
                  2
                )
            );

            const distanceInMeters = distance * 100000;

            console.log(
              'distance between driver and ' +
                userPassenger.firstName +
                ' s destination : ' +
                distanceInMeters
            );

            if (driverArrivedToPassengerDestination) {
              console.log(
                'driverArrivedToPassengerDestination ' +
                  userPassenger.firstName +
                  ' : ' +
                  driverArrivedToPassengerDestination
              );
              passenger.status = 'arrived';
              await ride.save({ validateBeforeSave: false });

              tripIntent.status = 'completed';

              const now = moment().tz('Africa/Tunis').format();

              await TripIntent.findByIdAndUpdate(
                tripIntent._id,
                (endDate = now),
                { status: 'completed' },
                { validateBeforeSave: false }
              );

              if (tripIntent?.originalFindRide) {
                const originalFindRide = await Ride.findById(
                  tripIntent.originalFindRide
                );

                if (originalFindRide) {
                  originalFindRide.status = 'completed';
                }
              }
            }
          }
          // **************
        }
      }

      const driverArrivedToDestination = inCircle(
        currentUser.location.latitude,
        currentUser.location.longitude,
        ride.destination.geometry.location.lat,
        ride.destination.geometry.location.lng,
        20
      );

      const distance = Math.sqrt(
        Math.pow(
          currentUser.location.latitude -
            ride.destination.geometry.location.lat,
          2
        ) +
          Math.pow(
            currentUser.location.longitude -
              ride.destination.geometry.location.lng,
            2
          )
      );

      const distanceInMeters = distance * 100000;

      if (driverArrivedToDestination) {
        console.log('driverArrivedToDestination ', driverArrivedToDestination);

        ride.status = 'completed';

        const now = moment().tz('Africa/Tunis').format();

        ride.endDate = now;

        ride.passengers.forEach((passenger) => {
          passenger.status = 'arrived';
        });
        await ride.save({ validateBeforeSave: false });

        await TripIntent.updateMany(
          {
            _id: { $in: tripIntents.map((tripIntent) => tripIntent._id) },
          },
          { status: 'completed' }
        );

        // **************
        const usersToEmitToDriver = [];

        for (const passenger of ride.passengers) {
          const passengerUser = await User.findById(passenger.user);

          const copyPassenger = { ...passengerUser._doc };

          copyPassenger.status = passenger.status || null;
          copyPassenger.rating = passenger.rating || null;

          usersToEmitToDriver.push(copyPassenger);
        }

        console.log('usersToEmitToDriver 2 ', usersToEmitToDriver);

        socket.emit('tripEnd', {
          users: usersToEmitToDriver,
          totalEarnings: ride.totalEarnings,
        });
      }
    }

    // *********************

    // const usersToEmit = [...users, currentUser];
    const usersToEmit = [];

    for (const user of users) {
      let userCopy = { ...user._doc };

      const userInPassengers = ride.passengers.find(
        (passenger) => passenger.user.toString() === user.id.toString()
      );

      if (userInPassengers) {
        userCopy.status = userInPassengers.status;
      } else {
        userCopy.status = null;
      }

      usersToEmit.push(userCopy);
    }

    const currentUserCopy = { ...currentUser._doc };

    const currentUserInPassengers = ride.passengers.find(
      (passenger) => passenger.user.toString() === currentUser.id.toString()
    );

    if (currentUserInPassengers) {
      currentUserCopy.status = currentUserInPassengers.status;

      const tripIntent = tripIntents.find(
        (tripIntent) =>
          tripIntent.passenger._id.toString() === currentUser.id.toString()
      );

      // if (tripIntent) {
      //   const { duration, distance } = await calculateDurationAndDistance(
      //     currentUser.location.latitude,
      //     currentUser.location.longitude,
      //     tripIntent.destination.geometry.location.lat,
      //     tripIntent.destination.geometry.location.lng
      //   ).catch((err) => {});

      //   if (duration && distance) {
      //     currentUserCopy.duration = duration;
      //     currentUserCopy.distance = distance;
      //   }
      // }
    } else {
      currentUserCopy.status = null;
    }

    if (ride?.status === 'completed') {
      return;
    }

    usersToEmit.push(currentUserCopy);

    Promise.all(
      usersToEmit.map(async (user) => {
        const userSocketId = await global.io
          .in(`notifications-${user._id}`)
          .allSockets();

        if (user._id.toString() === ride.user._id.toString()) {
          if (userSocketId.size > 0) {
            for (const socketId of userSocketId) {
              global.io.to(socketId).emit('updatedLocation', usersToEmit);
              // console.log('updatedLocation emitted to ', user.firstName);
            }

            console.log(
              'updatedLocation emitted to driver ' + ' 1' + ' ' + usersToEmit
            );
          }
        } else {
          const usersToEmitTo = [];

          usersToEmitTo.push(user);
          usersToEmitTo.push(ride.user);

          // console.log('usersToEmitTo ', usersToEmitTo);

          if (userSocketId.size > 0) {
            for (const socketId of userSocketId) {
              global.io.to(socketId).emit('updatedLocation', usersToEmitTo);
              // console.log('updatedLocation emitted to ', user.firstName);
            }
            console.log(
              'updatedLocation emitted to passenger' +
                ' 1' +
                ' ' +
                usersToEmitTo
            );
          }
        }
      })
    );
  });
};

module.exports = { socketMiddleware, socketGateway };
