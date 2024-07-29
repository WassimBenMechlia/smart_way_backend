const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path} : ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  console.log(value);

  const message = `Duplicate field value: ${value}. Please use another value`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  console.log('hello');
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Invalid input Data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 403);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 403);

const handleMulterError = () =>
  new AppError('You need to choose only 1 file to upload.', 401);

const handleTwilioPhoneError = () =>
  new AppError('Invalid phone number. Please try again.', 401);

const sendErrorDev = (err, res) => {
  // console.log({
  //   status: err.status,
  //   error: err,
  //   message: err.message,
  //   stack: err.stack,
  // });
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // console.log('Error', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    // ? some space
    if (err.name === 'CastError') err = handleCastErrorDB(err);
    if (err.code == 11000) err = handleDuplicateFieldsDB(err);
    if (err.name == 'ValidationError') err = handleValidationErrorDB(err);
    if (err.name == 'JsonWebTokenError') err = handleJWTError();
    if (err.name == 'TokenExpiredError') err = handleJWTExpiredError();
    if (err.code == 'LIMIT_UNEXPECTED_FILE') err = handleMulterError();
    if (err.code == 21211) err = handleTwilioPhoneError();

    sendErrorProd(err, res);
  }
};
