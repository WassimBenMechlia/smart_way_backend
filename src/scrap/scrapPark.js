const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');

const app = express();

app.use(cors());

app.get('/data', (req, res) => {
    const results = [];
    fs.createReadStream('../parkingList.csv')
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            res.json(results);
        });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
