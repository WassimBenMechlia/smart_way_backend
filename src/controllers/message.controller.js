const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchasync = require('../utils/catchAsync');
const Message = require('../models/message.model');
const Chat = require('../models/chat.model');
const { sendRealTimeNotification } = require('../utils/sharedFunctions');
const User = require('../models/user.model');

exports.createMessage = catchasync(async (req, res, next) => {
  var message = { ...req.body };
  message.sender = req.user.id;
  message.readBy = [req.user.id];

  if (!message.chat) {
    return next(new AppError('Please provide a chat for the message', 400));
  }

  var existingChat = await Chat.findById(message.chat);

  if (!existingChat) {
    return next(new AppError('Chat does not exist', 400));
  }

  const usersInChat = existingChat.users.map((user) => user.id);

  if (!usersInChat.includes(message.sender)) {
    return next(new AppError('You are not in this chat', 400));
  }

  if (req.body.files && req.body?.files?.files?.length > 0) {
    message.files = req.body?.files?.files;
  } else {
    message.files = [];
  }

  const newMessage = await Message.create(message);

  const populatedMessage = await Message.findById(newMessage.id);

 console.log(`chat id : ${message.chat}`);
  /* global.io
     .to(message.chat)
     .emit("newMessage", "test"); */

  const chatRoom = `chat-${populatedMessage.chat}`;
  const socketIdsInRoom = await global.io.in(chatRoom).allSockets();
  console.log(`socket ids room :${socketIdsInRoom}  length ${socketIdsInRoom.length} `);

  socketIdsInRoom.forEach((socketId) => {
    const id = global.io.sockets.sockets.get(socketId).user._id;
    if (id.toString() !== req.user.id.toString()) {
      console.log(
        'emitting to user : ',
        global.io.sockets.sockets.get(socketId).user.firstName
      );
      global.io.to(socketId).emit('newMessage', populatedMessage);
    }
  });
   

  // Send push notification to all users in the chat except the sender
  const usersInChatExceptSender = usersInChat.filter(
    (userId) => userId.toString() !== req.user.id.toString()
  );

  usersInChatExceptSender.forEach(async (userId) => {
    const notification = {
      title: 'You have a new message',
      description: `${req.user.firstName} ${req.user.lastName} sent you a message`,
      sender: req.user.id,
      receiver: userId,
    };

    const userToNotify = await User.findById(userId).select(
      'settings'
    );
    if (
      userToNotify?.settings?.notifications &&
      userToNotify?.settings?.messages
    ) {
      await sendRealTimeNotification(userId, notification, true, true);
    }
  });

  res.status(201).json({
    status: 'success',
    data: populatedMessage,
  });
});

exports.getDiscussion = catchasync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const usersInChat = chat.users.map((user) => user.id);

  if (!usersInChat.includes(req.user.id)) {
    return next(new AppError('You are not in this chat', 400));
  }

  if (req.query.sender) {
    req.query.user = req.query.sender;
    delete req.query.sender;
  }

  const features = new APIFeatures(
    Message.find({ chat: req.params.id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  let messages = await features.query;

  if (req.query.user) {
    messages = messages.filter((message) => {
      return (
        message.sender.firstName
          .toLowerCase()
          .includes(req.query.user.toLowerCase()) ||
        message.sender.lastName
          .toLowerCase()
          .includes(req.query.user.toLowerCase())
      );
    });
  }

  const count = await Message.countDocuments({ chat: req.params.id });

  res.status(200).json({
    status: 'success',
    count,
    results: messages.length,
    data: messages,
  });
});
