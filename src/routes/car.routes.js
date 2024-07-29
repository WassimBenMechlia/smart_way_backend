const express = require('express');

const authController = require('../controllers/auth.controller');
const carController = require('../controllers/car.controller');

const router = express.Router();

router.get(
  '/get-all-cars-models',
  carController.getAllCarsModels
);

 router
  .route('/')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'user'), 
    carController.getAllCars
  )
  .post(
    authController.protect,
    authController.restrictTo('user'), 
    carController.createCar
  );

router
  .route('/:id')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'user'),
    carController.getCar
  )
  .patch(
    authController.protect,
    authController.restrictTo('user'),
    carController.updateCar
  )
  .delete(
    authController.protect,
    authController.restrictTo('user'),
    carController.deleteCar
  );

module.exports = router;
