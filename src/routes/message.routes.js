const express = require('express');
const authController = require('../controllers/auth.controller');
const uploadController = require('../controllers/upload.controller');
const messageController = require('../controllers/message.controller');

const router = express.Router();

router
  .route('/')
  .post(
    authController.protect,
    uploadController.uploadAnyFilesFields([{ name: 'files' }]),
    uploadController.saveAnyFilesFields({
      files: 'files/messages',
    }),
    messageController.createMessage
  );

router
  .route('/:id')
  .get(authController.protect, messageController.getDiscussion);

module.exports = router;
