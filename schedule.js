const { scheduleJob } = require('node-schedule');
const Ride = require('./src/models/ride.model');
const moment = require('moment-timezone');

const activateRides = async () => {
  try {
    const now = moment().tz('Africa/Tunis').format('YYYY-MM-DDTHH:mm:ss[Z]');

    console.log('now: ', now);

    const rides = await Ride.find({
      mode: 'add_a_ride',
      status: 'pending',
      active: true,
      date: { $lte: now },
    });

    // change status to live for rides
    await Promise.all(
      rides.map(async (ride) => {
        ride.status = 'live';
        if (ride.passengers && ride.passengers.length > 0) {
          Promise.all(
            ride.passengers.map(async (passenger) => {
              passenger.status = 'waiting';
            })
          );
        }
        await ride.save();
      })
    );

    console.log('Rides activated: ', rides?.length);
  } catch (err) {
    console.log('error in activateRides');
  }
};

const desactivateRides = async () => {
  try {
    const now = moment().tz('Africa/Tunis').format('YYYY-MM-DDTHH:mm:ss[Z]');

    const rides = await Ride.find({
      mode: 'add_a_ride',
      status: 'live',
      active: true,
      date: { $lte: now },
    });

    let desactivatedRides = 0;

    await Promise.all(
      rides.map(async (ride) => {
        const rideDuration = ride.duration * 3;
        const rideDate = moment(ride.date).add(rideDuration, 'seconds');

        if (moment(rideDate).isBefore(now)) {
          const durInMinutes = rideDuration / 60;
          const rideDateFormatted = moment(ride?.date).format(
            'YYYY / MM / DD [at] HH:mm'
          );
          console.log(
            `${ride?._id?.toString()} date is : ${rideDateFormatted} and duration is : ${durInMinutes} minutes`
          );
          ride.status = 'completed';
          await ride.save();

          desactivatedRides++;
        }
      })
    );

    console.log('Rides desactivated: ', desactivatedRides);
  } catch (err) {
    console.log('error in desactivateRides', err);
  }
};

// Schedule the function to run every minute
scheduleJob('* * * * *', activateRides);

// Schedule the function to run every minute
scheduleJob('* * * * *', desactivateRides);

module.exports = { activateRides, desactivateRides };
