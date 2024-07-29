const express = require('express');

const authController = require('../controllers/auth.controller');
const rideController = require('../controllers/ride.controller');

const router = express.Router();

//TODO: Add this to swagger
router
  .route('/history')
  .get(
    authController.protect,
    authController.restrictTo('user'),
    rideController.ridesHistory
  );

router
  .route('/calculate-price')
  .post(
    authController.protect,
    authController.restrictTo('user'),
    rideController.calculatePrice
  );

//TODO: Add this to swagger
router
  .route('/rate/:rideId')
  .patch(
    authController.protect,
    authController.restrictTo('user'),
    //rideController.rateRide
  );

router
  .route('/:rideId/chat')
  .post(
    authController.protect,
    authController.restrictTo('user'),
    rideController.createChatForRide
  );

//TODO: Add this to swagger
/* router
   .route('/trip/init/:tripId')
   .post(
     authController.protect,
     authController.restrictTo('user'),
     rideController.initTrip
   );  */

//TODO: Add this to swagger
// router
//   .route('/trip/join/:tripId')
//   .patch(
//     authController.protect,
//     authController.restrictTo('user'),
//     rideController.joinTrip
//   );

//TODO: Add this to swagger
router
  .route('/search')
  .post(
    authController.protect,
    authController.restrictTo('user'),
    rideController.searchRides
  );

//TODO: Add this to swagger
  router.get(
    '/user-rating-comments/:id',
    authController.protect,
    //rideController.getRidesRating
  );


//TODO: Add this to swagger
router
  .route('/check-existing-ride/:rideId')
  .get(
    authController.protect,
    authController.restrictTo('user'),
    //rideController.checkExistingRide
  );

router
  .route('/')
  //TODO: update this to show only my rides instead of all rides (in swagger) (See Controller)
  .get(
    authController.protect,
    authController.restrictTo('user'),
    rideController.getAllRides
  )
  .post(
    authController.protect,
    authController.restrictTo('user'),
    // authController.cardCheck,
    rideController.createRide
  );

router
  .route('/:id')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'user'),
    rideController.getRide
  )
  //TODO: Add this to swagger
  .delete(
    authController.protect,
    authController.restrictTo('user'),
    rideController.deleteRide
  );

module.exports = router;
