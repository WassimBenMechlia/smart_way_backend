const User = require('../models/user.model');
const Ride = require('../models/ride.model');
const { getMessaging } = require('firebase-admin/messaging');
const stripeSk = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripePk = require('stripe')(process.env.STRIPE_PUBLIC_KEY);
const axios = require('axios');
const moment = require('moment-timezone');
const AppError = require('../utils/appError');
const Preference = require('../models/preference.model');


function inCircle(lat1, lon1, lat2, lon2, radiusInMeters) {
  const earthRadius = 6371e3; // Earth's radius in meters
  const lat1Radians = lat1 * (Math.PI / 180);
  const lon1Radians = lon1 * (Math.PI / 180);
  const lat2Radians = lat2 * (Math.PI / 180);
  const lon2Radians = lon2 * (Math.PI / 180);

  // Calculate the Haversine distance between the two points
  const dLat = lat2Radians - lat1Radians;
  const dLon = lon2Radians - lon1Radians;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Radians) *
      Math.cos(lat2Radians) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  // Check if the distance is less than or equal to the radius
  return distance <= radiusInMeters;
}

function getNowDate() {
  const now = moment().tz('Africa/Tunis').format('YYYY-MM-DDTHH:mm:ss[Z]');
  return now;
}

async function sendRealTimeNotification(
  receiverId,
  notification,
  emitToSocket = true,
  sendPushNotification = true
) {
  try {
    const user = await User.findById(receiverId);
    if (!user) return;
    if (!user?.settings?.notifications) return;
        console.log(receiverId);
    if (emitToSocket) {
      global.io
        .to(`notifications-${user._id.toString()}`)
        .emit('notification', notification);
    }

    console.log(user.email);
    console.log(user.deviceIds);

    if (sendPushNotification) {
      if (user.deviceIds && user.deviceIds.length > 0) {
        const invalidRegistrationTokens = [];

        const sendPromises = user.deviceIds.map(async (deviceId) => {
          const message = {
            notification: {
              title: notification.title,
              body: notification.description,
            },
            token: deviceId,
            android: {
              priority: 'high',
            },
            apns: {
              payload: {
                aps: {
                  contentAvailable: true,
                  priority: 'high',
                },
              },
            },
           
          };
          console.log(message);

          try {
            const response = await getMessaging(global.firebaseApp).send(
              message
            );
            console.log('Successfully sent message:', response);
          } catch (error) {
            invalidRegistrationTokens.push(deviceId);
            console.log(
              'deviceId error in sendRealTimeNotification ',
              deviceId
            );
          }
        });

        // Wait for all sendPromises to complete before logging invalidRegistrationTokens
        await Promise.all(sendPromises);

        if (invalidRegistrationTokens.length > 0) {
          user.deviceIds = user.deviceIds.filter(
            (deviceId) => !invalidRegistrationTokens.includes(deviceId)
          );
          await user.save();
        }
      }
    }
  } catch (err) {
    console.log('error in sendRealTimeNotification');
  }
}

async function searchRidesDependingOnStartAndEndLocation(
  userStartLatLon,
  userEndLatLon,
  query ={},
  radius = 16000 // 60000 meters
) {
  
  console.log(`rides : ${query}`);
  const rides = await Ride.find(query).populate({
    path: 'passengers.user',
    select: 'firstName lastName email photo',
    /* populate: {
      path: 'preferences.preference',
    }, */
  });
  console.log(`looking for ${userStartLatLon.lat},${userStartLatLon.lng} `);
  console.log(`looking for ${userEndLatLon.lat},${userEndLatLon.lng} `);

  const epsilon = 0.000001; // Define a small value for precision

  const filteredRides = rides.filter((ride) => {
    console.log("im here");
    const rideStartLatLon = {
      latitude: ride.startingPoint.geometry.location.lat,
      longitude: ride.startingPoint.geometry.location.lng,
    };
    console.log(rideStartLatLon.latitude);
    console.log(rideStartLatLon.longitude);
 
    const rideEndLatLon = {
      latitude: ride.destination.geometry.location.lat,
      longitude: ride.destination.geometry.location.lng,
    };

    const userToStartInCircle = inCircle(
      userStartLatLon.lat,
      userStartLatLon.lng,
      rideStartLatLon.latitude,
      rideStartLatLon.longitude,
      radius
    );

    const userToEndInCircle = inCircle(
      userEndLatLon.lat,
      userEndLatLon.lng,
      rideEndLatLon.latitude,
      rideEndLatLon.longitude,
      radius
    );
    const startEqualsUserStart =
      Math.abs(userStartLatLon.lat - rideStartLatLon.latitude) < epsilon &&
      Math.abs(userStartLatLon.lng - rideStartLatLon.longitude) < epsilon;
    
    const startEqualsUserEnd =
      Math.abs(userStartLatLon.lat - rideEndLatLon.latitude) < epsilon &&
      Math.abs(userStartLatLon.lng - rideEndLatLon.longitude) < epsilon;
    return (
      
      (userToStartInCircle && userToEndInCircle) ||
      (startEqualsUserStart && userToEndInCircle) ||
      (startEqualsUserEnd && userToStartInCircle)
    );
  });


  
  /* filteredRides.map((ride) => {
    ride.user.preferences = ride.user.preferences.filter(
      (preference) => preference.isAllowed
    );
  }); */

  return filteredRides;
}

async function calculateDurationAndDistance(lat1, lon1, lat2, lon2) {

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${lat1},${lon1}&destinations=${lat2},${lon2}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  try {
    const response = await axios.get(url);
    console.log(response.data);

    const distance = response.data.rows[0].elements[0].distance.value;
    const duration = response.data.rows[0].elements[0].duration.value;


     console.log('distance: ', distance);
     console.log('duration: ', duration);

    return { distance, duration };
  } catch (err) {
    console.log('error in calculateDurationAndDistance');
    return { distance: 0, duration: 0 };
  }
}

async function calculateTotalDistanceAndDuration(places) {
  console.log(places.startingPoint);
  console.log(places.destination);
  let totalDistance = 0;
  let totalDuration = 0;
  const { lat: lat1, lng: lon1 } = places.startingPoint.geometry.location;
    const { lat: lat2, lng: lon2 } = places.destination.geometry.location;
    

    const { distance, duration } = await calculateDurationAndDistance(
      lat1,
      lon1,
      lat2,
      lon2
    );

    totalDistance += distance / 1000; // in kilometers$
    totalDuration += duration / 60; // in minutes
  return { distance: totalDistance, duration: totalDuration };
}

function calculateGasolineCost(distance) {
  const costPerKilometer = 0.3; // Gasoline cost per kilometer
  return distance * costPerKilometer;
}

function calculateTimeCost(duration) {
  const costPerMinute = 0.15; // Time cost per minute
  return duration * costPerMinute;
}

function calculateDayNightCost(date) {
  const hour = new Date(date).getUTCHours();
  const nightSurcharge = hour >= 20 || hour < 6 ? 0.2 : 0; // 10% surcharge during night hours
  return nightSurcharge;
}

// ***************** STRIPE *****************

const createNewCustomer = async (user) => {
  try {
    const customer = await stripeSk.customers.create({
      email: user.email,
      name: user.firstName + ' ' + user.lastName,
    });

    return customer;
  } catch (err) {
    console.error(err);
    throw new Error('Error creating customer');
  }
};

const retrieveCustomer = async (user) => {
  try {
    const customer = await stripeSk.customers.retrieve(
      user.paymentDetails.stripeCustomerId
    );
    return customer;
  } catch (err) {
    // console.error(err);
    throw new Error('Error retrieving customer');
  }
};

const createToken = async (
  cardNumber,
  cardExpiryMonth,
  cardExpiryYear,
  cardCvc,
  cardHolderName
) => {
  try {
    const token = await stripePk.tokens.create({
      card: {
        number: cardNumber,
        exp_month: cardExpiryMonth,
        exp_year: cardExpiryYear,
        cvc: cardCvc,
        name: cardHolderName,
        currency: 'usd',
      },
    });

    return token;
  } catch (err) {
    // console.error(err);
    throw new Error('Error creating token, ' + err.message);
  }
};

const retrieveToken = async (tokenId) => {
  try {
    const token = await stripeSk.tokens.retrieve(tokenId);
    return token;
  } catch (err) {
    // console.error(err);
    throw new Error('Error retrieving token');
  }
};

const updateDefaultCard = async (customerId, cardId) => {
  try {
    const customer = await stripeSk.customers.update(customerId, {
      default_source: cardId,
    });
    return customer;
  } catch (err) {
    // console.error(err);
    throw new Error('Error updating default card');
  }
};

// create source
const createSource = async (customerId, tokenId) => {
  try {
    const source = await stripeSk.customers.createSource(customerId, {
      source: tokenId,
    });

    return source;
  } catch (err) {
    // console.error(err);
    throw new Error('Error creating source');
  }
};

// retrieve default card
const retrieveDefaultCard = async (customerId, cardId) => {
  try {
    const card = await stripeSk.customers.retrieveSource(customerId, cardId);
    return card;
  } catch (err) {
    // console.error(err);
    throw new Error('Error retrieving default card');
  }
};

const retrieveSource = async (customerId, cardId) => {
  try {
    const card = await stripeSk.customers.retrieveSource(customerId, cardId);
    return card;
  } catch (err) {
    // console.error(err);
    throw new Error('Error retrieving source');
  }
};

const deleteSource = async (customerId, cardId) => {
  try {
    const card = await stripeSk.customers.deleteSource(customerId, cardId);
    return card;
  } catch (err) {
    // console.error(err);
    throw new Error('Error deleting source');
  }
};

const paymentIntent = async (amount, customerId, cardId) => {
  try {
    const currency = 'usd';

    const roundedAmount = Math.round(amount * 100);

    const paymentIntent = await stripeSk.paymentIntents
      .create({
        amount: roundedAmount,
        currency: currency,
        customer: customerId,
        payment_method: cardId,
        off_session: true,
        confirm: true,
      })
      .catch((err) => {
        // console.log('err in paymentIntent', err);
      });

    return paymentIntent;
  } catch (err) {
    // console.error(err);
    throw new Error('Error creating payment intent');
  }
};

const refundPayment = async (paymentIntentId) => {
  try {
    const refund = await stripeSk.refunds.create({
      payment_intent: paymentIntentId,
    });

    return refund;
  } catch (err) {
    // console.error(err);
    throw new Error('Error refunding payment');
  }
};

const createConnectedAccount = async (user) => {
  try {
    const account = await stripeSk.accounts.create({
      type: 'express', // Use 'express' for a simplified setup
      country: 'US', // Set the appropriate country code
      email: user.email, // Set the email for the account
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
      business_type: 'individual',
      business_profile: {
        name: user.firstName + ' ' + user.lastName,
        mcc: '4722',
        product_description: 'Ridesharing',
        support_email: user.email,
        support_phone: '555-867-5309',
        url: 'https://www.figma.com/file/0PVNoP7wkcqOBL6y0lMWRl',
      },
      individual: {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone: '555-867-5309',
        dob: {
          day: '1',
          month: '1',
          year: '1990',
        },
        address: {
          city: 'New York',
          country: 'US',
          line1: '1234 Main Street',
          line2: 'Apartment 1',
          postal_code: '10000',
          state: 'NY',
        },
        id_number: '000000000',
        ssn_last_4: '0000',
      },
    });

    return account;
  } catch (err) {
    console.error(err);
    throw new Error('Error creating connected account');
  }
};

const retrieveConnectedAccount = async (accountId) => {
  try {
    const account = await stripeSk.accounts.retrieve(accountId);
    return account;
  } catch (err) {
    console.error(err);
    throw new Error('Error retrieving connected account');
  }
};

const createBankAccountToken = async (accountNumber, routingNumber) => {
  try {
    const token = await stripePk.tokens.create({
      bank_account: {
        account_number: accountNumber,
        routing_number: routingNumber,
        country: 'US',
        currency: 'usd',
        account_holder_name: 'Jenny Rosen',
        account_holder_type: 'individual',
        // Add other relevant details if needed
      },
    });

    return token;
  } catch (err) {
    console.error(err);
    throw new Error('Error creating bank account token');
  }
};

const createBankAccount = async (accountId, token) => {
  try {
    const bankAccount = await stripeSk.accounts.createExternalAccount(
      accountId,
      {
        external_account: token,
      }
    );

    return bankAccount;
  } catch (err) {
    console.error(err);
    throw new Error('Error creating bank account');
  }
};

const transferMoneyToBankAccount = async (amount, externalBankAccountId) => {
  try {
    const transfer = await stripeSk.transfers.create({
      amount: amount * 100, // Amount in cents (USD)
      currency: 'usd',
      destination: externalBankAccountId,
    });

    // Record the transfer in your database or handle success accordingly

    return transfer;
  } catch (err) {
    console.error(err);
    throw new Error('Error initiating money transfer to external bank account');
  }
};

const payoutToDriver = async (driver, amount) => {
  try {
    const transfer = await stripeSk.transfers.create({
      amount: amount * 100, // Amount in cents (USD)
      currency: 'usd',
      destination: driver.paymentDetails.stripeConnectedAccountId,
    });

    // Record the transfer in your database or handle success accordingly

    return transfer;
  } catch (err) {
    console.error(err);
    throw new Error('Error initiating payout to driver');
  }
};

const checkDriverBalance = async (driver) => {
  try {
    const balance = await stripeSk.balance.retrieve({
      stripeAccount: driver.paymentDetails.stripeConnectedAccountId,
    });

    return balance;
  } catch (err) {
    console.error(err);
    throw new Error('Error checking driver balance');
  }
};

const checkUserHasCard = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (
      !user?.paymentDetails?.stripeCustomerId ||
      !user?.paymentDetails?.stripeCardsIds ||
      user?.paymentDetails?.stripeCardsIds?.length === 0
    ) {
      throw new AppError(
        'You need to add a payment card to perform this action',
        403
      );
    }

    const customer = await retrieveCustomer(user).catch((err) => {});

    if (!customer) {
      throw new AppError(
        'You need to add a payment card to perform this action',
        403
      );
    }

    const card = await retrieveDefaultCard(
      customer.id,
      customer.default_source
    );

    if (!card) {
      throw new AppError(
        'You need to add a payment card to perform this action',
        403
      );
    }

    const cardExists = user.paymentDetails.stripeCardsIds.find(
      (id) => id === card.id
    );

    if (!cardExists) {
      throw new AppError(
        'You need to add a payment card to perform this action',
        403
      );
    }
  } catch (err) {
    throw new AppError(
      err?.message || 'Error checking if user has a card',
      err?.statusCode || 500
    );
  }
};

const calculateApplicationFee = (amount) => {
  return Math.round(amount * 0.18); // 18% application fee
}

module.exports = {
  inCircle,
  sendRealTimeNotification,
  createNewCustomer,
  retrieveCustomer,
  createToken,
  retrieveToken,
  updateDefaultCard,
  createSource,
  retrieveDefaultCard,
  retrieveSource,
  deleteSource,
  searchRidesDependingOnStartAndEndLocation,
  paymentIntent,
  refundPayment,
  createConnectedAccount,
  payoutToDriver,
  checkDriverBalance,
  calculateDurationAndDistance,
  retrieveConnectedAccount,
  createBankAccountToken,
  createBankAccount,
  transferMoneyToBankAccount,
  calculateTotalDistanceAndDuration,
  calculateGasolineCost,
  calculateTimeCost,
  calculateDayNightCost,
  getNowDate,
  checkUserHasCard,
  calculateApplicationFee
};
