const express = require('express');
const authController = require('../controllers/auth.controller');
const chatController = require('../controllers/chat.controller');

const router = express.Router();

//TODO: add this to swagger
router
  .route('/search/:word')
  .get(authController.protect, chatController.search);

router
  .route('/')
  .get(authController.protect, chatController.getChats)
  .post(authController.protect, chatController.createChat);

router
  .route('/:id')
  .get(authController.protect, chatController.getChatById)
  .patch(
    authController.protect,
    chatController.joinChatToUpdateReadedByMessages
  )
  .delete(authController.protect, chatController.deleteChat);

module.exports = router;
