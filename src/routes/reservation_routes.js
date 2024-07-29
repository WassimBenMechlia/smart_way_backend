const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation_controller');

// Route to get all reservations
router.get('/get-all-reservations', reservationController.getAllReservations);
router.delete('/:reservationId', reservationController.deleteReservation);
router.post('/extend', reservationController.extendReservation);

router.get('/get-object', reservationController.object);
router.get('/notifRes', reservationController.getnotifications);
router.post('/adminNotif', reservationController.sendAdminNotif);
module.exports = router;
