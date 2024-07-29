const catchAsync = require('../utils/catchAsync');

exports.calculateDistance = catchAsync(async (req, res, next) => {
    try {
        const { coord1, coord2 } = req.body;

        // Check if both coordinates are provided
        if (!coord1 || !coord2) {
            return res.status(400).json({ error: 'Please provide both coordinates' });
        }

        // Function to calculate distance between two sets of coordinates using Haversine formula
        function calculateDistance(coord1, coord2) {
            const [lon1, lat1] = coord1;
            const [lon2, lat2] = coord2;

            const R = 6371; // Radius of the earth in km
            const dLat = deg2rad(lat2 - lat1);
            const dLon = deg2rad(lon2 - lon1);

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c; // Distance in km

            return distance;
        }

        function deg2rad(deg) {
            return deg * (Math.PI / 180);
        }

        // Calculate distance
        const distance = calculateDistance(coord1, coord2);

        res.json({ distance });
    } catch (error) {
        console.error('Error calculating distance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
