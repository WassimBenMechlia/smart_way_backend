const jwt = require('jsonwebtoken'); // Import jsonwebtoken package
const Notification = require('../models/notification.model');
const moment = require('moment-timezone');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const Email = require('../utils/email');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { promisify } = require('util');
const dotenv = require('dotenv');
const fs = require('fs');
const csv = require('csv-parser');
const { spawn } = require('child_process');
const Reservation = require('../models/Reservation'); 
const Car = require('../models/car.model');
const carsList = require('../constants/cars.json');
const Preference = require('../models/preference.model');const mongoose = require('mongoose');
const fastCsv = require('fast-csv');
const {
  sendRealTimeNotification,

} = require('../utils/sharedFunctions');

dotenv.config({ path: './.env' });

  exports.login= catchAsync(async(req, res,next) =>{
    
      const { email, password ,deviceId} = req.body;
      
      const user = await User.findOne({ email })
    .select('+password')
    .populate('defaultCar')
    .populate('preferences.preference');
      if (!user) {
        return next(new AppError('User not found', 400));
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return next(new AppError('Invalid password', 400));
      }
      if (!user.isEmailVerified) {
        return next(new AppError('Account not verified', 400));
      }
      if (deviceId) {
        const deviceExists = user.deviceIds.find((id) => id === deviceId);
        if (!deviceExists) {
          user.deviceIds.push(deviceId);
          await user.save();
        }
      }


      const accessToken = generateAccessToken(user);
       res.status(200).json({
        status: 'success',
        id:user.id,
        firstName : user.firstName,
        lastName :  user.lastName,
        email :  user.email,
        accessToken: accessToken,
        deviceId : user.deviceIds,
        photo : user.photo,
       
        defaultCar : user.defaultCar,
        bio : user.bio,
      });
    
  })


  
exports.signupAddInformations = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password } =
    req.body;

  switch (req.body) {
    case !firstName:
      return next(new AppError('Please provide your name', 400));
    case !lastName:
      return next(new AppError('Please provide your last name', 400));
    case !email:
      return next(new AppError('Please provide your email', 400));
    case !password:
      return next(new AppError('Please provide your password', 400));
    
    default:
      break;
  }
  console.log(password);
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(hashedPassword);
  const existingUser = await User.findOne({
    email: email,
  });
  if (existingUser) {
    if(!existingUser.isEmailVerified){
      await existingUser.deleteOne();
    }else{
      return next(new AppError('This email is already in use', 400));
    }
  }
  const adminPreferences = await Preference.find({
    isCreatedByAdmin: true,
  });
  /* if (data?.files && data?.files?.photo?.length > 0) {
    data.photo = data.files.photo[0];
  } */
  const user = new User({
    firstName,
    lastName,
    email,
    password : hashedPassword,
  });

  adminPreferences.forEach((preference) => {
    user.preferences.push({
      preference: preference._id,
      isAllowed: false,
    });
  });
 
    
        
  try {
    const verificationCode = generateVerificationCode();
    console.log(verificationCode);
    user.createVerificationToken(verificationCode);
    await user.save({ validateBeforeSave: false });
    await new Email(user, verificationCode).sendVerificationEmail();
    return res.status(200).json({
        status: 'success',
        message: 'Verification email sent successfully!',
      });
  } catch (err) {
    let errorMessage = 'An internal error occurred';

  if (err instanceof DioException) {
    errorMessage = 'Connection failed: This indicates an error which most likely cannot be solved by the library.';
  } else if (err instanceof OtherSpecificError) {
    errorMessage = 'Another specific error occurred';
  }
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError(err.message, 500));
  }

});

/*   exports.sendVerificationEmail=catchAsync(async(req, res, next) =>{
    const email = req.body.email;
    const usermodel = await User.findOne({email});
    if(usermodel){
      return res.status(400).json({
        status: 'failed',
        message: 'email allready used ',
      });
    }      
    let emailVerification = await EmailVerificationModel.findOne({email});
    if(!emailVerification){
      emailVerification = new EmailVerificationModel({ email });
    }
    if (emailVerification.isEmailVerified) {
      return res.status(200).json({
        status: 'success',
        message: 'Verification email sent successfully!',
      });
    }
    try {
      const verificationCode = generateVerificationCode();
      emailVerification.createVerificationToken(verificationCode);
      await emailVerification.save({ validateBeforeSave: false });
      await new Email(emailVerification, verificationCode).sendVerificationEmail();
      return res.status(200).json({
          status: 'success',
          message: 'Verification email sent successfully!',
        });
    } catch (err) {
      emailVerification.emailVerificationToken = undefined;
      emailVerification.emailVerificationExpires = undefined;
      await emailVerification.save({ validateBeforeSave: false });
      return next(new AppError(err.message, 500));
    }
}); */



 exports.verifyEmail=catchAsync( async(req, res, next) =>{
  const { email, code } = req.body;
   const user = await User.findOne({
    email 
  });
  if(!user){
    return next(
      new AppError('user not found ', 400)
    );
  }

  if(user.emailVerificationToken !=crypto
    .createHash('sha256') 
    .update(code)
    .digest('hex') ) {
    return res.status(400).json({
      status: 'failed',
      message: 'incorrect code !',
    });
  }else if(Date.now() > user.emailVerificationExpires){
    return res.status(400).json({
      status: 'failed',
      message: 'token has expired !',
    });
  }else{
    await User.findOneAndUpdate(
      { email },
      { $set: { isEmailVerified: true } }
    );
    return res.status(200).json({
      status: 'success',
      data:user,
      message: 'Email verified successfully' 
    });
  }
});
exports.verifyEmailForResetPassword=catchAsync( async(req, res, next) =>{
  const { email, code } = req.body;
   const user = await User.findOne({
    email 
  });
  if(!user){
    return next(
      new AppError('user not found ', 400)
    );
  }

  if(user.emailVerificationToken !=crypto
    .createHash('sha256') 
    .update(code)
    .digest('hex') ) {
    return res.status(400).json({
      status: 'failed',
      message: 'incorrect code !',
    });
  }else if(Date.now() > user.emailVerificationExpires){
    return res.status(400).json({
      status: 'failed',
      message: 'token has expired !',
    });
  }else{
    await User.findOneAndUpdate(
      { email },
      { $set: { isEmailVerified: true } }
    );
    const accessToken = generateAccessToken(user);
    return res.status(200).json({
      status: 'success',
      accessToken : accessToken, 
      message: 'Email verified successfully' 
    });
  }
});
  
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.signupAddCars = catchAsync(async (req, res, next) => {
  let userAddedCar = false;

  const { email, brand, model, color, licensePlateNumber } = req.body;

  const user = await User.findOne({
    email,
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }
  if (brand && model && color && licensePlateNumber) {
    userAddedCar = true;

    if (!brand) return next(new AppError('A car must have a brand', 400));
    if (!model) return next(new AppError('A car must have a model', 400));
    if (!color) return next(new AppError('A car must have a color', 400));

    const carBrand = carsList.find(
      (car) =>
        car.name.toLowerCase() === brand.toLowerCase() ||
        car.id.toLowerCase() === brand.toLowerCase()
    );
    if (!carBrand)
      return next(new AppError('This car brand does not exist', 400));

    const carModel = carBrand.models.find(
      (m) =>
        m.name.toLowerCase() === model.toLowerCase() ||
        m.id.toLowerCase() === model.toLowerCase()
    );
    if (!carModel)
      return next(new AppError('This car model does not exist', 400));

    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color))
      return next(new AppError('This color is not valid', 400));

    const newCar = await Car.create({
      brand,
      model,
      color,
      licensePlateNumber,
      user: user._id,
    });

    user.defaultCar = newCar._id;
  }


  await user.save();


  return res.status(201).json({
    status: 'success',
    data: user,
    message: userAddedCar
      ? 'Congratulations, you completed your registration and added your car successfully '
      : 'Congratulations, you completed your registration successfully ',
  });
});
exports.getMe = catchAsync(async (req, res, next) => {
  const query = {};

  let user = await User.findById(req.user.id)
    .select('+balance')
    .populate('defaultCar')
    .populate('preferences.preference');

  if (req.query?.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query.select = fields;

    userPromise = User.findById(req.user.id).select(fields);

    if (req.query?.fields?.includes('defaultCar')) {
      userPromise.populate('defaultCar');
    }
    if (req.query?.fields?.includes('preferences')) {
      userPromise.populate('preferences.preference');
    }

    user = await userPromise;
  }

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  user.balance = Number(user.balance.toFixed(2));

  res.status(200).json({
    status: 'success',
    data: user,
  });
});



  exports.protect=catchAsync( async (req, res, next)=>{
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
  
    if (!token) {
      return next(
        new AppError('You are not logged in ! Please login to get access.', 403)
      );
    }
  
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    console.log(decoded.name);
  
    const currentUser = await User.findById(decoded.id);
  
    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          403
        )
      );
    }
  
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 403)
      );
    }
  
    req.user = currentUser;
    next();
  });
  
  


// Define a controller function to handle GET requests for fetching all users
exports.getUsers = async (req, res, next) => {
  try {
    // Retrieve all users from the database
    const users = await User.find();

    // Check if users array is empty
    if (users.length === 0) {
      // If no users found, return a custom error message
      return res.status(404).json({
        status: 'error',
        message: 'No users found'
      });
    }

    // Return the list of users as a response
    res.status(200).json({
      status: 'success',
      data: users
    });
  } catch (error) {
    // If an error occurs, pass it to the error handling middleware
    return next(error);
  }
};





exports.updatePassword = async (req, res, next) => {
  try {
    // Extract token from request headers
    const token = req.headers['authorization'];

    // Ensure token is provided
    if (!token) {
      throw new Error('Authorization token is missing');
    }

    // Verify access token
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error('JWT secret key is missing');
    }
    const decoded = jwt.verify(token.replace('Bearer ', ''), secretKey);
    const userId = decoded.id;

    // Find user in the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Extract email, old and new passwords from request body
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      throw new Error('Email, old and new passwords are required');
    }

    // Validate if the email in the request matches the user's email
    if (email !== user.email) {
      throw new Error('Email does not match the user');
    }

    // Validate old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Old password is incorrect');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password in the database
    user.password = hashedPassword;
    await user.save();

    // Construct response data
    const responseData = {
      user: {
        id: user._id,
        email: user.email,
        // Include any other user data you want to return
      },
      message: 'Password updated successfully'
    };

    // Log response data to console
    console.log('Response Data:', responseData);

    // Send success response with data
    return res.status(200).json(responseData);
  } catch (error) {
    // Log error to console
   
    return next(error);
  }
};



  
/* async logout(req, res) {
  try {
    res.clearCookie('accessToken');
    res.json({ message: 'Logout successful' });
  } catch (error) {
      res.status(500).json({ message: 'Error logging out' });
  }
} */

exports.forgotPassword = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    });
    if (!user) {
      return next(new AppError('There is no user with this email address', 404));
    }

    const verificationCode = generateVerificationCode();
    user.createVerificationToken(verificationCode);
    await user.save({ validateBeforeSave: false });
    
    await new Email(user, verificationCode).sendForgotPassword();

    return res.status(200).json({
        status: 'success',
        message: 'Verification email sent successfully!',
      });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError(err, 500));
  }
});


const CSV_FILE_PATH = './src/scrap/parkingList.csv';

// Utility function to read data from CSV file
const readCSV = () => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Utility function to append data to CSV file
const appendToCSV = (newData) => {
  return new Promise((resolve, reject) => {
    // Check if the CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      fs.appendFileSync(CSV_FILE_PATH, '\n'); //
      fs.writeFileSync(CSV_FILE_PATH, 'id,parkingName,codeParking,adress,location,capacity,description,phoneContact,mailContact\n');
      fs.appendFileSync(CSV_FILE_PATH, '\n'); // Add a newline character after the header
    }
    

    // Format the data fields with double quotes and join them with commas
    const formattedData = [
      `${newData.id}`,
      `"${newData.parkingName}"`,
      `${newData.codeParking}`,
      `"${newData.adress}"`,
      `"${newData.location}"`,
      `${newData.capacity}`,
      `"${newData.description}"`,
      `"${newData.phoneContact}"`,
      `${newData.mailContact}`, // Remove quotes around mailContact field
    ].join(',');

    // Append the formatted data to the file
    fs.appendFile(CSV_FILE_PATH, `${formattedData}\n`, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
// Utility function to write data to CSV file
const writeCSV = (data) => {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(CSV_FILE_PATH);
    fastCsv
      .write(data, { headers: true })
      .pipe(ws)
      .on('finish', resolve)
      .on('error', reject);
  });
}

// Read (GET) all data
exports.getDataFromCSV = async (req, res, next) => {
  try {
    const results = await readCSV();
    res.json(results);
  } catch (error) {
    console.error('Error reading CSV file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create (POST) new data
exports.postDataToCSV = async (req, res, next) => {
  try {
    const newData = req.body;
    console.log('Data received:', newData); // Ajoutez cette ligne pour afficher les données reçues
    await appendToCSV(newData);
    res.status(201).send(newData);
  } catch (error) {
    console.error('Error writing to CSV file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.deleteDataFromCSV = async (req, res, next) => {
  try {
    const id = req.params.id;
    let data = await readCSV();
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      const deletedItem = data.splice(index, 1);
      await writeCSV(data);
      res.json(deletedItem);
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    console.error('Error deleting from CSV file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400
      )
    );
  }


  const data = req.body;
  console.log(data);



  if (data.email) {
    const foundUserWithEmail = await User.findOne({
      email: data.email,
    });

    if (
      foundUserWithEmail &&
      foundUserWithEmail._id.toString() !== req.user.id
    ) {
      return next(new AppError('This email is already in use', 400));
    }
  }

 /*  if (data.phone) {
    const foundUserWithPhone = await User.findOne({
      phone: data.phone,
    });

    if (
      foundUserWithPhone &&
      foundUserWithPhone._id.toString() !== req.user.id
    ) {
      return next(new AppError('This phone is already in use', 400));
    }
  } */

  if (data?.files && data?.files?.photo?.length > 0) {
    data.photo = data.files.photo[0];
  }

  if (data.deletePhoto === 'true' || data.deletePhoto === true) {
    data.photo = 'default.jpg';
  }

  /* if (data.defaultCar) {
    const car = await Car.findById(data.defaultCar);
    if (!car) {
      return next(new AppError('No car found with that ID', 404));
    }
    if (car?.user?._id?.toString() !== req.user.id.toString()) {
      return next(new AppError('You are not the owner of this car', 403));
    }
  } */


  

  const updatedUser = await User.findByIdAndUpdate(req.user.id, data, {
    new: true,
    runValidators: true,
  })
    .populate('defaultCar');
    

  const returnData = {
    status: 'success',
    firstName : updatedUser.firstName,
    lastName :  updatedUser.lastName,
    email :  updatedUser.email,
    deviceId : updatedUser.deviceIds,
    photo : updatedUser.photo,
    defaultCar : updatedUser.defaultCar,
    bio : updatedUser.bio,
    //type: updateUserTypes.NONE,
  };

  /* if (data.email && data.email !== req.user.email) {
    const resetToken = updatedUser.createVerificationToken();

    updatedUser.isEmailVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const resetURL = `${process.env.BACKEND_URL}/api/v1/users/verify-email/${resetToken}`;
    // const resetURL = `${req.protocol}://${req.get(
    //   'host'
    // )}/api/v1/users/verify-email/${resetToken}`;

    await new Email(updatedUser, resetURL).sendVerifyEmail();

    returnData.message =
      'Your email has been updated. Please verify your email address';

    delete returnData.data;

    returnData.type = updateUserTypes.EMAIL;
  } */

  console.log(updatedUser);

  /* if (data.phone && data.phone !== req.user.phone) {
    const code = Math.floor(1000 + Math.random() * 9000);

    updatedUser.phoneVerificationToken = code;

    updatedUser.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;

    updatedUser.isPhoneVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const message = await client.messages
      .create({
        body: `Your verification code is ${code} (valid for 10 minutes) eUE7AxZ3R3k`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: req.body.phone,
      })
      .catch((err) => {});

   

    console.log('code : ', code);

    if (returnData.type === updateUserTypes.EMAIL) {
      returnData.type = updateUserTypes.ALL;

      returnData.message =
        'Your email and phone number have been updated. Please verify your email address and phone number';
    } else {
      returnData.type = updateUserTypes.PHONE;

      returnData.message =
        'Your phone number has been updated. Please verify your phone number';
    }

    delete returnData.data;
  } */

  return res.status(200).json(returnData);
});



exports.updateOldPassword = catchAsync(async (req, res, next) => {
  const newPassword = req.body.password;
  if (!newPassword) {
    return next(
      new AppError(
        'A new password is needed to change your old password',
        400
      )
    );
  }
    const data = req.body;
    console.log(data);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = req.user;
      // Update user's password in the database
    user.password = hashedPassword;
    await user.save();


  const returnData = {
    status: 'success',
    message:'password updated successfully'
  };
  return res.status(200).json(returnData);
});




exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  user.active = false;

  await user.save();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
exports.getUserById = catchAsync(async (req, res, next) => {
  // get user by id and don't show password
  const user = await User.findById(req.params.id)
    .populate('defaultCar')
    .populate('preferences.preference');

  user.preferences = user.preferences.filter(
    (preference) => preference.isAllowed
  );

  user.passwordChangedAt = undefined;
  user.deviceIds = undefined;

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});


exports.policeAlerte = async (req, res) => {
  try {
    const results = [];

    // Read data from CSV file
    fs.createReadStream('./scraped_data.csv')
      .pipe(csv())
      .on('data', (data) => {
        // Convert latitude and longitude strings to numbers
        data.Latitude = parseFloat(data.Latitude);
        data.Longitude = parseFloat(data.Longitude);
        results.push(data);
      })
      .on('end', () => {
        // Send data as JSON response
        res.json(results);
      });

    // Execute Python script
    const pyProg = spawn('python', ['././src/scrap/incidents_tec_policeroute.py']);

    pyProg.stdout.on('data', function(data) {
      console.log(data.toString());
      // You can choose to send this Python output as a separate response or merge it with the CSV data
    });

    pyProg.on('close', () => {
      // You can choose to send a response indicating Python script execution completion
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    User.find({
      role: 'user',
    }).select('firstName lastName email phone balance transactions'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const users = await features.query;

  users?.map((user) => {
    user.preferences = undefined;
  });

  return res.status(200).json({
    status: 'success',
    results: users?.length || 0,
    data: users || [],
  });
});
exports.getUsersForChat = catchAsync(async (req, res, next) => {
  const usersThatHaveChatWithMe = await Chat.find({
    $and: [{ users: { $in: [req.user.id] } }, { users: { $size: 2 } }],
  }).select('users');

  let usersThatHaveChatWithMeIds = [];

  usersThatHaveChatWithMe.map((chat) => {
    const ids = chat.users.map((user) => user._id.toString());

    ids.splice(ids.indexOf(req.user.id), 1);

    usersThatHaveChatWithMeIds = [...usersThatHaveChatWithMeIds, ...ids];
  });

  const features = new APIFeatures(
    User.find({
      _id: { $nin: [...usersThatHaveChatWithMeIds, req.user.id] },
      signupStatus: 'COMPLETED',
    }).select('firstName lastName email photo'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const users = await features.query;

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: users,
  });
});

exports.transportAlerte = async (req, res) => {
  try {
    const results = [];

    // Read data from CSV file
    fs.createReadStream('./transport.csv')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Send data as JSON response
        res.json(results);
      });

    // Execute Python script
    const pyProg = spawn('python', ['././src/scrap/incident.py']);

    pyProg.stdout.on('data', function(data) {
      console.log(data.toString());
      // You can choose to send this Python output as a separate response or merge it with the CSV data
    });

    pyProg.on('close', () => {
      // You can choose to send a response indicating Python script execution completion
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.calculatePriceWithDetails = async (req, res, next) => {
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

    const { start_date, end_date, parkingName, car_details, etat } = req.body;
  
    // Validate if all required fields are present in the request body
    if (!start_date || !end_date || !parkingName || !car_details || !etat) {
      return res.status(400).json({ error: 'start_date, end_date, parkingName, car_details, and etat are required.' });
    }
   

    const now = moment().tz('Africa/Tunis');
    const startDate = moment.tz(start_date, 'Africa/Tunis');
    const endDate = moment.tz(end_date, 'Africa/Tunis');
    
    
    console.log('Parsed start_date:', startDate);
    console.log('Parsed end_date:', endDate);
    const currentDate = now;
    console.log('end1  ',endDate)
    console.log('start1  ',startDate)
    console.log('cuurentDate',currentDate)
    // Find the latest reservation of the user

    
    // Check if start date is greater than or equal to the current date
    if (startDate <= currentDate) {
      const responseObj = {
        error: 'La date de début doit être postérieure à la date actuelle.',
        message: 'La date de début doit être postérieure à la date actuelle.'
      };
      return res.status(400).json(responseObj);
    }
    const latestReservation = await Reservation.findOne({ user: user._id }).sort({ end_date: -1 });

    // Check if the latest reservation exists and if the new start date is before the end date of the latest reservation
    if (latestReservation && startDate < latestReservation.end_date) {
  
      const responseObj = {
        error: 'New start date must be after the end date of your latest reservation.',
        message: 'New start date must be after the end date of your latest reservation.'
      };
      return res.status(400).json(responseObj);
    }

    // Calculate time difference in milliseconds
    const diffInMs = endDate - startDate;

    // Convert time difference to hours and minutes
    let diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    let diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

    // Calculate price based on time difference
    const price = (diffInHours + diffInMinutes / 60) * 200; // 200 cents per hour

    // Format the duration string based on whether there are hours or not
    let durationString = '';
    if (diffInHours > 0) {
      durationString += `${diffInHours} hours`;
      if (diffInMinutes > 0) {
        durationString += ` and ${diffInMinutes} minutes`;
      }
    } else {
      durationString += `${diffInMinutes} minutes`;
    }
    // Create a new reservation instance based on the Reservation model
    const reservation = new Reservation({
      start_date,
      end_date,
      parkingName,
      car_details,
      etat,
      price // Include price in the reservation object
    });
    const notification = await Notification.create({
      title: 'alerte',
      description: `${user.firstName} 15 min`,
      sender: user.id,
      receiver: user.id,
    });
    await sendRealTimeNotification(
      user.id,
      notification,
      true,
      true
    );
    // Save the reservation to the database
    await reservation.save();
    // Prepare response JSON object
    const responseObj = {
      id: reservation._id, // Include the ID of the saved reservation
      start_date,
      end_date,
      parkingName: reservation.parkingName,
      car_details: reservation.car_details,
      etat: reservation.etat,
      duration: durationString,
      price: price.toFixed(2) + ' cents', // Format price in cents
      message: 'Reservation saved successfully'
    };
    res.json(responseObj);
    console.log(responseObj);
  } catch (error) {
    // Pass the error to the error handling middleware
    return next(new AppError(error.message, 500));
  }
};


function generateVerificationCode() {
  // Generate a random number between 100000 and 999999
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString(); // Convert the number to a string
};


const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};


exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  user.active = false;

  await user.save();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});


/* 
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400
      )
    );
  }

  const data = req.body;

  if (data.balance) {
    return next(new AppError('You cannot update your balance', 400));
  }

  //   console.log(data);

  if (data.email) {
    const foundUserWithEmail = await User.findOne({
      email: data.email,
    });

    if (
      foundUserWithEmail &&
      foundUserWithEmail._id.toString() !== req.user.id
    ) {
      return next(new AppError('This email is already in use', 400));
    }
  }

  if (data.phone) {
    const foundUserWithPhone = await User.findOne({
      phone: data.phone,
    });

    if (
      foundUserWithPhone &&
      foundUserWithPhone._id.toString() !== req.user.id
    ) {
      return next(new AppError('This phone is already in use', 400));
    }
  }

  if (data?.files && data?.files?.photo?.length > 0) {
    data.photo = data.files.photo[0];
  }

  if (data.deletePhoto === 'true' || data.deletePhoto === true) {
    data.photo = 'default.jpg';
  }

  if (data.defaultCar) {
    const car = await Car.findById(data.defaultCar);
    if (!car) {
      return next(new AppError('No car found with that ID', 404));
    }
    if (car?.user?._id?.toString() !== req.user.id.toString()) {
      return next(new AppError('You are not the owner of this car', 403));
    }
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, data, {
    new: true,
    runValidators: true,
  })
    .populate('defaultCar')
    .populate('preferences.preference');

  const returnData = {
    status: 'success',
    data: updatedUser,
    type: updateUserTypes.NONE,
  };

  if (data.email && data.email !== req.user.email) {
    const resetToken = updatedUser.createVerificationToken();

    updatedUser.isEmailVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const resetURL = `${process.env.BACKEND_URL}/api/v1/users/verify-email/${resetToken}`;
    // const resetURL = `${req.protocol}://${req.get(
    //   'host'
    // )}/api/v1/users/verify-email/${resetToken}`;

    await new Email(updatedUser, resetURL).sendVerifyEmail();

    returnData.message =
      'Your email has been updated. Please verify your email address';

    delete returnData.data;

    returnData.type = updateUserTypes.EMAIL;
  }

  console.log(data);

  if (data.phone && data.phone !== req.user.phone) {
    const code = Math.floor(1000 + Math.random() * 9000);

    updatedUser.phoneVerificationToken = code;

    updatedUser.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;

    updatedUser.isPhoneVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const message = await client.messages
      .create({
        body: `Your verification code is ${code} (valid for 10 minutes) eUE7AxZ3R3k`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: req.body.phone,
      })
      .catch((err) => {});

    // if (message) returnData.code = code; //TODO: remove this line

    console.log('code : ', code);

    if (returnData.type === updateUserTypes.EMAIL) {
      returnData.type = updateUserTypes.ALL;

      returnData.message =
        'Your email and phone number have been updated. Please verify your email address and phone number';
    } else {
      returnData.type = updateUserTypes.PHONE;

      returnData.message =
        'Your phone number has been updated. Please verify your phone number';
    }

    delete returnData.data;
  }

  return res.status(200).json(returnData);
});
 */
// Function to verify the token
const verifyToken = async (token) => {
  try {
    // Verify the token using the secret key from environment variables
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null; // Token verification failed
  }
};
/* 
exports.updateData = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400
      )
    );
  }

  const data = req.body;

 

     console.log(data);

  if (data.email) {
    const foundUserWithEmail = await User.findOne({
      email: data.email,
    });

    if (
      foundUserWithEmail &&
      foundUserWithEmail._id.toString() !== req.user.id
    ) {
      return next(new AppError('This email is already in use', 400));
    }
  }

  

  if (data?.files && data?.files?.photo?.length > 0) {
    data.photo = data.files.photo[0];
  }

  if (data.deletePhoto === 'true' || data.deletePhoto === true) {
    data.photo = 'default.jpg';
  }

  if (data.defaultCar) {
    const car = await Car.findById(data.defaultCar);
    if (!car) {
      return next(new AppError('No car found with that ID', 404));
    }
    if (car?.user?._id?.toString() !== req.user.id.toString()) {
      return next(new AppError('You are not the owner of this car', 403));
    }
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, data, {
    new: true,
    runValidators: true,
  })
    .populate('defaultCar')
    .populate('preferences.preference');

  const returnData = {
    status: 'success',
    data: updatedUser,
    type: updateUserTypes.NONE,
  };

   if (data.email && data.email !== req.user.email) {
    const resetToken = updatedUser.createVerificationToken();

    updatedUser.isEmailVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const resetURL = `${process.env.BACKEND_URL}/api/v1/users/verify-email/${resetToken}`;
    // const resetURL = `${req.protocol}://${req.get(
    //   'host'
    // )}/api/v1/users/verify-email/${resetToken}`;

    await new Email(updatedUser, resetURL).sendVerifyEmail();

    returnData.message =
      'Your email has been updated. Please verify your email address';

    delete returnData.data;

    returnData.type = updateUserTypes.EMAIL;
  }

  console.log(data);

   if (data.phone && data.phone !== req.user.phone) {
    const code = Math.floor(1000 + Math.random() * 9000);

    updatedUser.phoneVerificationToken = code;

    updatedUser.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;

    updatedUser.isPhoneVerified = false;

    await updatedUser.save({ validateBeforeSave: false });

    const message = await client.messages
      .create({
        body: `Your verification code is ${code} (valid for 10 minutes) eUE7AxZ3R3k`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: req.body.phone,
      })
      .catch((err) => {});

    // if (message) returnData.code = code; //TODO: remove this line

    console.log('code : ', code);

    if (returnData.type === updateUserTypes.EMAIL) {
      returnData.type = updateUserTypes.ALL;

      returnData.message =
        'Your email and phone number have been updated. Please verify your email address and phone number';
    } else {
      returnData.type = updateUserTypes.PHONE;

      returnData.message =
        'Your phone number has been updated. Please verify your phone number';
    }

    delete returnData.data;
  } 

  return res.status(200).json(returnData);
}); */