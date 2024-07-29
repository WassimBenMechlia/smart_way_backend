const express = require('express');
const router = express.Router();
const distanceController = require('../controllers/distanceController');

router.post('/calculateDistance', distanceController.calculateDistance);


module.exports = router;
