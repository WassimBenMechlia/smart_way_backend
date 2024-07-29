const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchasync = require('../utils/catchAsync');
const Chat = require('../models/chat.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');

exports.createChat = catchasync(async (req, res, next) => {
  var chat = { ...req.body };
  chat.creator = req.user.id;

  if (!chat.users) {
    return next(new AppError('Please provide users for the chat', 400));
  }

  if (!chat.users.includes(chat.creator)) {
    chat.users.push(chat.creator);
  }

  if (chat.users.length < 2) {
    return next(new AppError('Please provide at least 2 users', 400));
  }

  const users = await User.find({ _id: { $in: chat.users } });

  let isThereAnyUserNotInChat = false;

  if (users.length !== chat.users.length) {
    isThereAnyUserNotInChat = true;
  }

  chat.users = users.map((user) => user.id);

  if (chat.users.length < 2) {
    if (isThereAnyUserNotInChat) {
      return next(
        new AppError(
          'Please provide at least 2 users. Some of the users do not exist',
          400
        )
      );
    } else {
      return next(new AppError('Please provide at least 2 users', 400));
    }
  }

  const newChat = await Chat.create(chat);

  newChat.users = await User.find({ _id: { $in: newChat.users } }).select(
    'firstName lastName email photo'
  );

  newChat.creator = await User.findById(newChat.creator).select(
    'firstName lastName email photo'
  );

  res.status(201).json({
    status: 'success',
    data: newChat,
  });
});

exports.getChatById = catchasync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const usersInChat = chat.users.map((user) => user.id);

  if (!usersInChat.includes(req.user.id)) {
    return next(new AppError('You are not in this chat', 400));
  }

  chat.messageCount = await Message.countDocuments({
    chat: chat.id,
  });

  chat.lastMessage = await Message.findOne({
    chat: chat.id,
  })
    .sort({ createdAt: -1 })
    .select('-chat -__v -updatedAt');

  res.status(200).json({
    status: 'success',
    data: chat,
  });
});

exports.getChats = catchasync(async (req, res, next) => {
  const features = new APIFeatures(Chat.find({ users: req.user.id }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  let chats = await features.query;

  // chats.forEach((chat) => {
  //   chat.users = chat.users.filter((user) => user.id !== req.user.id);
  // });

  for (let i = 0; i < chats.length; i++) {
    const messageCount = await Message.countDocuments({
      chat: chats[i].id,
    });
    chats[i].messageCount = messageCount;
    chats[i].lastMessage = await Message.findOne({
      chat: chats[i].id,
    })
      .sort({ createdAt: -1 })
      .select('-chat -__v -updatedAt');
  }

  chats.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return b.lastMessage.createdAt - a.lastMessage.createdAt;
    } else if (a.lastMessage && !b.lastMessage) {
      return -1;
    } else if (!a.lastMessage && b.lastMessage) {
      return 1;
    } else {
      return 0;
    }
  });

  if (req.query.user) {
    chats = chats.filter((chat) => {
      return chat.users.some((user) => {
        return (
          user.firstName.toLowerCase().includes(req.query.user.toLowerCase()) ||
          user.lastName.toLowerCase().includes(req.query.user.toLowerCase())
        );
      });
    });
  }

  const count = await Chat.countDocuments({ users: req.user.id });

  res.status(200).json({
    status: 'success',
    results: chats.length,
    count,
    data: chats,
  });
});

exports.joinChatToUpdateReadedByMessages = catchasync(
  async (req, res, next) => {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return next(new AppError('No chat found with that ID', 404));
    }

    if (chat.users.includes(req.user.id)) {
      return next(new AppError('You are already in this chat', 400));
    }

    await Message.updateMany(
      { chat: chat.id },
      { $addToSet: { readBy: req.user.id } }
    );

    return res.status(200).json({
      status: 'success',
      data: chat,
    });
  }
);

exports.search = catchasync(async (req, res, next) => {
  const word = req.params.word;

  if (!word || word.trim().length === 0) {
    this.getChats(req, res, next);
    return;
  }

  const users = await User.find({
    $or: [
      { firstName: { $regex: word, $options: 'i' } },
      { lastName: { $regex: word, $options: 'i' } },
    ],
  }).select('firstName lastName email photo');

  const chats = await Chat.find({
    $and: [
      {
        $or: [{ users: { $in: [req.user.id] } }, { creator: req.user.id }],
      },
      {
        $or: [
          { users: { $in: users.map((user) => user.id) } },
          { creator: { $in: users.map((user) => user.id) } },
        ],
      },
    ],
  });

  // add last message and message count
  for (let i = 0; i < chats.length; i++) {
    const messageCount = await Message.countDocuments({
      chat: chats[i].id,
    });
    chats[i].messageCount = messageCount;
    chats[i].lastMessage = await Message.findOne({
      chat: chats[i].id,
    })
      .sort({ createdAt: -1 })
      .select('-chat -__v -updatedAt');
  }

  chats.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return b.lastMessage.createdAt - a.lastMessage.createdAt;
    } else if (a.lastMessage && !b.lastMessage) {
      return -1;
    } else if (!a.lastMessage && b.lastMessage) {
      return 1;
    } else {
      return 0;
    }
  });

  res.status(200).json({
    status: 'success',
    data: chats,
  });
});

exports.deleteChat = catchasync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const usersInChat = chat?.users?.map((user) => user?._id?.toString()) ?? [];

  if (!usersInChat.includes(req.user.id)) {
    return next(new AppError('You are not allowed to delete this chat', 400));
  }

  await Message.deleteMany({ chat: chat.id });

  await Chat.findByIdAndDelete(chat.id);

  return res.status(204).json({
    status: 'success',
    data: null,
  });
});
