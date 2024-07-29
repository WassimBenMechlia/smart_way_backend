const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser'); // Added missing 'const' keyword
const authController = require('../controllers/auth.controller');
const verifyToken = require('../useCases/verifyToken'); // Import verifyToken middleware
const uploadController = require('../controllers/upload.controller');


// Instantiate authController

// Middleware
router.use(express.json());
router.use(cookieParser());

// Routes
router.post('/login', authController.login);
router.get('/getUsers', authController.getUsers);
router.post('/signupAddCars', authController.signupAddCars);
router.post('/verifyMail', authController.verifyEmail);
router.post('/signupAddInformations', authController.signupAddInformations); 
router.get('/data', authController.getDataFromCSV);
router.post('/postDataCsv', authController.postDataToCSV);
router.delete('/deleteDataCsv/:id', authController.deleteDataFromCSV);
router.get('/policeAlerte', authController.policeAlerte)
router.get('/transportAlerte', authController.transportAlerte)
router.post('/calculate-price', authController.calculatePriceWithDetails);
router.post('/update-password', authController.updatePassword);
router.post('/forgot_password',authController.forgotPassword);
router.post('/reset_password',
  authController.protect,
  authController.updateOldPassword);
router.post('/verify_mail_forgot_password',
  authController.verifyEmailForResetPassword);
//router.post('/update-Data', authController.updateData);
router
  .route('/update_user')
  .get(authController.protect, authController.getMe)
  .patch(
    authController.protect,
    uploadController.uploadAnyFilesFields([{ name: 'photo', maxCount: 1 }]),
    uploadController.saveAnyFilesFields({
      photo: 'images/users',
    }),
    authController.updateMe
  )
  .delete(authController.protect, authController.deleteUser);

  router.post('/verifyMail_Reset_password', authController.verifyEmail);

//update
/* router.put('/:id',  authController.updateUser.bind(authController));
//updatePassword
router.put('/:id/password',  authController.updatePassword.bind(authController));
//logout
router.post('/logout', authController.logout.bind(authController)); */


module.exports = router;
