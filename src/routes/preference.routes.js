const express = require('express');

const authController = require('../controllers/auth.controller');
const preferenceController = require('../controllers/preference.controller');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    preferenceController.getAllPreferences
  )
  .post(
    authController.protect,
    preferenceController.createPreference
  );

module.exports = router;
