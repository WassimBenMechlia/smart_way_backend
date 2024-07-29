const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    parkingName: {
        type: String,
        required: true
    },
    car_details: {
        type: String,
        required: true
    },
    etat: {
        type: String,
        enum: ['reserved', 'Not-reserved','expired'],
        required: true
    }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;