const http = require('http');
const app = require('./app');
const mongoose = require('mongoose');
const Server = require('socket.io').Server;
const socketGateway = require('./socket').socketGateway;
const socketMiddleware = require('./socket').socketMiddleware;
const { credential } = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');

const normalizePort = val => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
};


const ipAddress = '192.168.43.24';

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const errorHandler = error => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  const address = server.address();
  const bind = typeof address === 'string' ? 'pipe ' + address : 'port: ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges.');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use.');
      process.exit(1);
      break;
    default:
      throw error;
  }
};


const DB = process.env.MONGO_URL;
console.log(DB);
mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch(() => console.log('Connexion à MongoDB échouée !'));

const server = http.createServer(app);

server.on('error', errorHandler);
server.on('listening', () => {
  const address = server.address();
  const bind = typeof address === 'string' ? 'pipe ' + address : 'port ' + port;
  console.log('Listening on ' + bind);
  console.log(address.address);
});
//var io = require("socket.io")(server);

/* app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/socket.io/client-dist/socket.io.js');
}); */


const io = new Server(server, {
  cors: { origin: '*'},
});




io.use(socketMiddleware);

global.users = [];

io.on('connection', (socket) => socketGateway(socket, io));
io.on('connect', async (socket) => {
  try {
    const user = socket.user;
    user.seenAt = true;
    await user.save();
    console.log(`user ${user.firstName} ${user.lastName} connected`);

    global.users.push({
      id: user?._id?.toString(),
      socket,
    });
    

    socket.join(`notifications-${user.id}`);
    console.log(
      `user ${socket.user.firstName} ${user.lastName} joined notifications-${user.id}`
    );
  } catch (err) {
    console.log('error in join notifications');
  }
});

global.io = io;

(async () => {
  // Your web app's Firebase configuration
  const firebaseConfig = {
    credential: credential.cert('./street_management_config.json'),
    // credential: credential.cert('./test-notification-f0ac1-710f7208755f.json'),
  };

  // Initialize Firebase
  const firebaseApp = initializeApp(firebaseConfig);

  global.firebaseApp = firebaseApp;
})();


server.listen(port , "0.0.0.0" , () => {
  console.log(`Server running at http://localhost:${port}/`);
}); 
