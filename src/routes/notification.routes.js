const express = require('express');
const authController = require('../controllers/auth.controller');
const notificationController = require('../controllers/notification.controller');

const router = express.Router();

//TODO: Add this to swagger
router
.route('/')
.get(authController.protect, notificationController.getNotifications);

//TODO: Add this to swagger
router
  .route('/:id')
  .get(authController.protect, notificationController.getNotification);


module.exports = router;
