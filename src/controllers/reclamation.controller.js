const catchAsync = require('../utils/catchAsync');
const Reclamation = require('../models/reclamation.model'); // Import your Reclamation model
const jwt = require('jsonwebtoken'); // Require the jsonwebtoken library
const mongoose = require('mongoose');
const AppError = require('../utils/appError');
exports.getAllReclamations = catchAsync(async (req, res, next) => {
    try {
        // Retrieve all reclamations from the database
        let reclamations = await Reclamation.find();
        reclamations = reclamations.reverse();
        // Send the reclamations as a JSON response
        res.json(reclamations);
    } catch (error) {
        console.error('Error retrieving reclamations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


exports.createReclamation = catchAsync(async (req, res, next) => {
    try {
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
       
        // Extract fields from the request body
        const { name, email, object, description } = req.body;

        // Create a new reclamation
        const newReclamation = await Reclamation.create({
            name,
            email,
            object,
            description
        });

        // Send the newly created reclamation as a JSON response
        res.status(201).json(newReclamation);
    } catch (error) {
        return next(new AppError(error.message, 500));
    }
});

exports.deleteReclamation = catchAsync(async (req, res, next) => {
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
        } // <- This closing curly brace was missing

        try {
            // Extract reclamation ID from the request parameters
            const { reclamationId } = req.params;

            // Check if the reclamation ID is valid
            if (!mongoose.Types.ObjectId.isValid(reclamationId)) {
                return res.status(400).json({ error: 'Invalid reclamation ID' });
            }

            // Check if the reclamation exists
            const reclamation = await Reclamation.findById(reclamationId);
            if (!reclamation) {
                return res.status(404).json({ error: 'Reclamation not found' });
            }

            // Delete the reclamation
            await Reclamation.findByIdAndDelete(reclamationId);

            // Send a success message
            res.json({ message: 'Reclamation deleted successfully' });
        } catch (error) {
            console.error('Error deleting reclamation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
