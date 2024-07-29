const express = require('express');
const { spawn } = require('child_process');


const app = express();

app.get('/ReelTimetransport', (req, res) => {
    const pyProg = spawn('python', ['../incident.py']);

    pyProg.stdout.on('data', function(data) {
        console.log(data.toString());
        res.write(data);
    });

    pyProg.on('close', () => {
        res.end('end');
    });
});

app.listen(3300, () => console.log('Application listening on port 3300!'));
