const express = require('express');
const { spawn } = require('child_process');


const app = express();

app.get('/parkPay', (req, res) => {
    const pyProg = spawn('python', ['../testpark.py']);

    pyProg.stdout.on('data', function(data) {
        console.log(data.toString());
        res.write(data);
    });

    pyProg.on('close', () => {
        res.end('end');
    });
});

app.listen(3309, () => console.log('Application listening on port 3309!'));
