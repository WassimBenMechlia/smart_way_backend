const express = require('express');
const { spawn } = require('child_process');


const app = express();

app.get('/ReelTimeInfo', (req, res) => {
    const pyProg = spawn('python', ['../incidents_tec_policeroute.py']);

    pyProg.stdout.on('data', function(data) {
        console.log(data.toString());
        res.write(data);
    });

    pyProg.on('close', () => {
        res.end('end');
    });
});

app.listen(3300, () => console.log('Application listening on port 3300!'));
