const express = require('express');

const authController = require('../controllers/auth.controller');
const tripintentController = require('../controllers/tripintent.controller');

const router = express.Router();

//TODO: Add this to swagger
router
  .route('/join/:rideId')
  .post(
    authController.protect,
    //authController.cardCheck,
    tripintentController.joinRide
  );

  router
  .route('/suggestAnotherPrice/:tripIntentId')
  .patch(
    authController.protect,
    tripintentController.suggestAnotherPrice
  );

//TODO: Add this to swagger
router
  .route('/add-to-ride/:findRideId/:addToRideId?')
  .post(
    authController.protect,
    // authController.cardCheck,
    tripintentController.addToRide
  );

router
  .route('/:id')
  .get(authController.protect, tripintentController.getTripIntentsByRide)
  .patch(
    authController.protect,
    //authController.customerCheck,
    tripintentController.acceptOrDeclineTripIntent)
  .delete(authController.protect,
    tripintentController.deleteTripIntent
  );


  router
  .route('/getTripIntentByUsers')
  .post(authController.protect, tripintentController.getTripIntentsByUsers);


  router
  .route('/paymentIntent/:id')
  .patch(
    authController.protect,
    //authController.customerCheck,
    tripintentController.payForTripIntent
  );
  
module.exports = router;
