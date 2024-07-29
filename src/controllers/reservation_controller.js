const catchAsync = require('../utils/catchAsync');
const Reservation = require('../models/Reservation'); // Import your Reservation model
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const moment = require('moment-timezone');
const User = require('../models/user.model');

const Notification = require('../models/notification.model');


const {
    sendRealTimeNotification,
    searchRidesDependingOnStartAndEndLocation,
    retrieveCustomer,
    retrieveDefaultCard,
    paymentIntent,
    refundPayment,
    calculateDurationAndDistance,
    calculateApplicationFee
  } = require('../utils/sharedFunctions');

  exports.getAllReservations = catchAsync(async (req, res, next) => {
    try {
        // Function to verify JWT token
        const verifyToken = async (token) => {
            try {
                return await jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                return null; // Token verification failed
            }
        };

        // Extract token from authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Authorization header:', authHeader);
            return res.status(401).json({ error: 'Bearer token is required' });
        }

        const token = authHeader.split(' ')[1];

        // Validate the token
        const user = await verifyToken(token);

        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Retrieve latest 5 reservations
        const reservations = await Reservation.find().sort({ start_date: -1 }).limit(5);

        // Current date
        const currentDate = moment().tz('Africa/Tunis');

        // Process reservations
        const reservationsWithDetails = await Promise.all(reservations.map(async (reservation) => {
            const startDate = moment.tz(reservation.start_date, 'Africa/Tunis').add(1, 'hours');
            const endDate = moment.tz(reservation.end_date, 'Africa/Tunis').add(1, 'hours');

            const diffInMs = endDate - startDate;
            const diffInMsToCurrent =   endDate - currentDate;
            const diffInMinutesToCurrent = Math.floor(diffInMsToCurrent / (1000 * 60));

            console.log("Difference in milliseconds between start and end date:", diffInMs);
            console.log("Difference in milliseconds between end date and current date:", diffInMsToCurrent);
            console.log("Difference in minutes between current date and end date:", diffInMinutesToCurrent);

            console.log("Start Date:", startDate.format('YYYY-MM-DD HH:mm:ss'));
            console.log("End Date:", endDate.format('YYYY-MM-DD HH:mm:ss'));
            console.log("Current Date:", currentDate.format('YYYY-MM-DD HH:mm:ss'));
            console.log(` -------------------- `);

            if (currentDate > endDate && reservation.etat !== 'expired') {
                reservation.etat = 'expired';
                await reservation.save();
            }

            let diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            let diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

            const price = (diffInHours + diffInMinutes / 60) * 200; // 200 cents per hour

            let durationString = '';
            if (diffInHours > 0) {
                durationString += `${diffInHours} hours`;
                if (diffInMinutes > 0) {
                    durationString += ` and ${diffInMinutes} minutes`;
                }
            } else {
                durationString += `${diffInMinutes} minutes`;
            }

            const formattedStartDate = startDate.format('YYYY-MM-DD HH:mm');
            const formattedEndDate = endDate.format('YYYY-MM-DD HH:mm');

            // Send notification if 0-15 minutes left
            if (diffInMinutesToCurrent <= 15 && diffInMinutesToCurrent >= 0) {
                const notification = await Notification.create({
                    title: 'alerte',
                    description: `you still have 15 min`,
                    sender: user.id,
                    receiver: user.id,
                });
                await sendRealTimeNotification(user.id, notification, true, true);
            }

            return {
                id: reservation._id,
                start_date: formattedStartDate,
                end_date: formattedEndDate,
                parkingName: reservation.parkingName,
                car_details: reservation.car_details,
                etat: reservation.etat,
                price: price.toFixed(2) + ' cents',
                duration: durationString
            };
        }));

        // Send processed reservations as JSON response
        res.json(reservationsWithDetails);
    } catch (error) {
        console.error('Error retrieving reservations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


exports.deleteReservation = catchAsync(async (req, res, next) => {
    try {
        // Define the verifyToken function for token verification
        const verifyToken = async (token) => {
            try {
                // Verify the token using the secret key from environment variables
                const decoded = await jwt.verify(token, process.env.JWT_SECRET);
                return decoded;
            } catch (error) {
                return null; // Token verification failed
            }
        };

        const authHeader = req.headers.authorization;

        // Check if authorization header is provided and starts with 'Bearer '
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Authorization header:', authHeader); // Log authorization header
            return res.status(401).json({ error: 'Bearer token is required' });
        }

        const token = authHeader.split(' ')[1]; // Extract the token part from the header

        // Validate the token here using the locally defined verifyToken function
        const user = await verifyToken(token);

        // If token is invalid, return 401 Unauthorized
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Extract reservation ID from the request parameters
        const { reservationId } = req.params;

        // Check if the reservation ID is valid
        if (!mongoose.Types.ObjectId.isValid(reservationId)) {
            return res.status(400).json({ error: 'Invalid reservation ID' });
        }

        // Check if the reservation exists
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        // Check if the time difference between current date and end date is less than or equal to 15 minutes
        const currentDate = moment().tz('Africa/Tunis');
const endDate = moment(reservation.end_date).tz('Africa/Tunis');
console.log('End Date:', endDate);
console.log('Current Time:', currentDate);

const timeDifference = endDate.diff(currentDate, 'minutes');
console.log('Time Difference in Minutes:', timeDifference);

  
        const timeDifferenceInMinutes = Math.ceil(timeDifference / (1000 * 60)); // Convert milliseconds to minutes
        console.log('diifernce time ',timeDifferenceInMinutes)
        const fifteenMinutes = 15; // 15 minutes
        
        if (timeDifference <= fifteenMinutes && timeDifferenceInMinutes >0 ) {
            // If the difference is 15 minutes or less, return an error
            const responseObj = {
                error: 'Impossible de supprimer la réservation, moins de 15 minutes restantes',
                message: 'Impossible de supprimer la réservation, moins de 15 minutes restantes'
              };
              return res.status(400).json(responseObj);
        }
        
        // Delete the reservation
        await Reservation.findByIdAndDelete(reservationId);


        // Send a success message
        res.json({ message: 'Reservation deleted successfully' });
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

exports.extendReservation = async (req, res, next) => {
    try {
        // Extract reservation ID and additional time from the request body
        const { reservationId, additionalTime } = req.body;

        // Fetch the reservation from the database
        const reservation = await Reservation.findById(reservationId);

        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        // Extract current end date/time
        const currentEndDate = new Date(reservation.end_date);

        // Calculate new end date/time
        const newEndDate = new Date(currentEndDate.getTime() + additionalTime * 60000); // Convert additional time to milliseconds

        // Update reservation with the new end date/time
        reservation.end_date = newEndDate;
        await reservation.save();

        // Format the new end date without AM/PM designation
        const formattedEndDate = newEndDate.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Use 24-hour format
        });

        // Construct response
        const response = {
            message: 'Reservation extended successfully',
            reservation: {
                id: reservation._id,
                start_date: reservation.start_date,
                end_date: formattedEndDate, // Format the end date before sending
                // Include other reservation details if needed
            }
        };

        // Send response
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};
// Define the allowed object types
const allowedObjectTypes = ['Covoiturage', 'Parking', 'PublicTransport', 'Autre'];

// Define a route handler to get the allowed object types
exports.object = async (req, res,next) =>  {
  try {
    res.json(allowedObjectTypes);
  } catch (error) {
    console.error('Error getting allowed object types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// const WebSocket = require('ws');


// const wss = new WebSocket.Server({ port: 8080 });

// // Function to fetch reservation data
// async function getReservationData() {
//     try {
//         // Fetch reservation data from your database or wherever it's stored
//         const reservations = await Reservation.find().sort({ end_date: -1 }).limit(1); // Fetching the reservation with the earliest end date
// console.log(reservations)
//         // Return the reservation data
//         return reservations[0]; // Assuming we only need one reservation for this example
//     } catch (error) {
//         console.error('Error fetching reservation data:', error);
//         throw error;
//     }
// }

// // Function to calculate end date minus 15 minutes
// function calculateEndDateMinus15(endDate) {
//     return new Date(endDate.getTime() - 15 * 60000);
// }

// // Set up a WebSocket connection
// wss.on('connection', async function connection(ws) {
//     try {
//         // Fetch reservation data
//         const reservation = await getReservationData();

//         if (!reservation) {
//             throw new Error('No reservations found');
//         }

//         // Calculate end date minus 15 minutes
//         const endDateMinus15 = calculateEndDateMinus15(reservation.end_date);

//         // Send only the end date minus 15 minutes to the client
//         ws.send(JSON.stringify({ 
//             endDateMinus15: endDateMinus15,
//             title: "Attention", 
//             description: "Attention: vous avez encore 15 minutes"
//         }));
        

//         // Close the connection after sending the message
//         ws.close();
//     } catch (error) {
//         console.error('WebSocket connection error:', error);
//         ws.close();
//     }
// });


// Function to fetch reservation data
exports.getnotifications = async (req, res, next) => {
    try {
            // Define the verifyToken function for token verification
            const verifyToken = async (token) => {
                try {
                    // Verify the token using the secret key from environment variables
                    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
                    return decoded;
                } catch (error) {
                    return null; // Token verification failed
                }
            };
    
            const authHeader = req.headers.authorization;
    
            // Check if authorization header is provided and starts with 'Bearer '
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('Authorization header:', authHeader); // Log authorization header
                return res.status(401).json({ error: 'Bearer token is required' });
            }
    
            const token = authHeader.split(' ')[1]; // Extract the token part from the header
    
            // Validate the token here using the locally defined verifyToken function
            const user = await verifyToken(token);
    
            // If token is invalid, return 401 Unauthorized
            if (!user) {
                return res.status(401).json({ error: 'Invalid token' });
            }
    
        // Fetch reservation data from your database
        const reservations = await Reservation.find().sort({ end_date: -1 }).limit(1); // Fetching the reservation with the earliest end date
        
        if (!reservations.length) {
            throw new Error('No reservations found');
        }

        // Calculate end date minus 15 minutes
        // const endDateMinus15 = calculateEndDateMinus15(reservations[0].end_date);

        res.json({ 
            // endDateMinus15: endDateMinus15,
            title: "Attention", 
            description: "Vous avez encore 15 minutes"
        });
    } catch (error) {
        return next(new AppError(error.message, 500));
    }
};



exports.sendAdminNotif = async (req, res) => {
    const { title, description } = req.body;

    // Check if both title and description are provided
    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    try {
       
        // Retrieve all users except the admin(s)
        const users = await User.find({ role: { $ne: 'admin' } });

        // Send notifications to each user concurrently
        const notificationPromises = users.map(async (user) => {
            const notification = await Notification.create({
                // title: 'New Passenger Request for Joining Trip',
                // description: `${user.firstName} wants to join your trip`,
                title,
                description,
               // sender: tripIntent.._id,
                receiver: user._id,
              });
            await sendRealTimeNotification(
                user._id,
                notification,
                true,
                true
            );
        });

        await Promise.all(notificationPromises);

        // Respond with the provided title and description
        res.json({ title, description, status: 'success' });
    } catch (error) {
        // Handle errors
        console.error('Error sending notifications:', error);
        res.status(500).json({ error: 'An error occurred while sending notifications' });
    }
};
const NotificationService = {
    sendNotification: (userId, title, description) => {
        // Simulate sending a notification
        console.log(`Notification sent to user ${userId}: ${title} - ${description}`);

        (userId, title, description)
        
        true,
        true
    }
    
};

// Function to calculate end date minus 15 minutes
function calculateEndDateMinus15(endDate) {
    return new Date(endDate.getTime() - 15 * 60000);
}