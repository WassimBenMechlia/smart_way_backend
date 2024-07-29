const express = require('express');
const dotenv = require('dotenv');
const globalErrorHandler = require('./src/controllers/error.controller');
const http = require('http');
const bodyParser = require('body-parser');
const authRoutes = require('./src/routes/auth.routes');
const carRoutes = require('./src/routes/car.routes');
const reservationRoutes = require('./src/routes/reservation_routes');
const reclamationRoutes = require('./src/routes/reclamation.routes');
const rideRoutes = require('./src/routes/ride.routes');
const trip = require('./src/routes/tripintent.routes');
const preferenceRouter = require('./src/routes/preference.routes');
const distanceRoutes = require('./src/routes/distance.routes');
const chatRouter = require('./src/routes/chat.routes');
const NotifRouter = require('./src/routes/notification.routes');
const messageRouter = require('./src/routes/message.routes');
const passport = require('passport');
const { initializeApp } = require('firebase-admin/app');
const { credential } = require('firebase-admin');
const { activateRides, desactivateRides } = require('./schedule');
const cookieParser = require('cookie-parser');
const { getMessaging } = require('firebase-admin/messaging');
const mongoSanitize = require('express-mongo-sanitize');
const socketGateway = require('./socket').socketGateway;
const socketMiddleware = require('./socket').socketMiddleware;
const cors = require('cors');
const Server = require('socket.io').Server;
const app = express();
const server = http.createServer(app);
const helmet = require('helmet');
const xss = require('xss-clean');
const session = require('express-session');
const { error } = require('console');


dotenv.config({ path: './.env' });

  
  // ************* FIREBASE ***************
  
  
  
  app.use(cookieParser());
  
  app.use(cors());
  
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  
  // ***************************************
  
  
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  
  app.use(mongoSanitize());
  
  app.use(xss());
  
  app.use(express.static(`${__dirname}/public`));  
  app.use('/.well-known', express.static(`${__dirname}/.well-known`));
  
  app.set('view engine', 'ejs');
  
  app.use(
    session({
      resave: false,
      saveUninitialized: true,
      secret: 'SECRET',
    })
  );
  
  app.use(passport.initialize());
  app.use(passport.session());
  
  app.get('/', (req, res) => {
    res.send('API is running...');
  });
  
  
  activateRides();

  desactivateRides();

app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/reservations', reservationRoutes);   
app.use('/reclamations', reclamationRoutes);
app.use('/api/ride', rideRoutes);
app.use('/api/chats', chatRouter);
app.use('/api/messages', messageRouter);
app.use('/api/trip', trip);
app.use('/api/preferences',preferenceRouter);
app.use('/api/notif',NotifRouter);
app.use('/api/routes',distanceRoutes);


app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (req.accepts('json')) {
    // If the request accepts JSON, send the error as JSON
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
    });
  } else {
    // Otherwise, send the error as HTML
    res.status(err.statusCode).send(`<pre>${err.message}</pre>`);
  }
});

module.exports = app;