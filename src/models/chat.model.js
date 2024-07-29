const mongoose = require('mongoose');
const Message = require('./message.model');

const chatSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Chat must belong to a user'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

chatSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'users',
    select: 'firstName lastName photo seenAt',
  }).populate({
    path: 'creator',
    select: 'firstName lastName photo seenAt',
  });

  next();
});

chatSchema.virtual('messageCount', {
  ref: 'Message',
  foreignField: 'chat',
  localField: '_id',
  count: true,
});

chatSchema.virtual('lastMessage', {
  ref: 'Message',
  foreignField: 'chat',
  localField: '_id',
  justOne: true,
  options: { sort: { createdAt: -1 } },
  populate: { path: 'readBy', select: 'firstName lastName photo' },
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
