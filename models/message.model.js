const mongoose = require('mongoose');

// Conversation schema - groups messages between users about a property
const conversationSchema = new mongoose.Schema({
  // Participants
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Property the conversation is about (optional)
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },

  // Related transaction (if applicable)
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },

  // Last message for preview
  lastMessage: {
    content: String,
    senderId: mongoose.Schema.Types.ObjectId,
    sentAt: Date
  },

  // Unread count per participant
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },

  // Who archived it
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Message schema
const messageSchema = new mongoose.Schema({
  // Conversation this message belongs to
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },

  // Sender
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message content
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },

  // Message type
  type: {
    type: String,
    enum: ['text', 'offer_notification', 'system', 'document_shared'],
    default: 'text'
  },

  // Attachments (for document sharing)
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],

  // Read status per recipient
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata for special message types
  metadata: {
    offerId: mongoose.Schema.Types.ObjectId,
    documentId: mongoose.Schema.Types.ObjectId,
    action: String
  },

  // Soft delete
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ property: 1 });
conversationSchema.index({ transaction: 1 });
conversationSchema.index({ updatedAt: -1 });

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// Update conversation's lastMessage after saving a message
messageSchema.post('save', async function() {
  try {
    const Conversation = mongoose.model('Conversation');
    await Conversation.findByIdAndUpdate(this.conversation, {
      lastMessage: {
        content: this.content.substring(0, 100),
        senderId: this.sender,
        sentAt: this.createdAt
      },
      $inc: { [`unreadCount.${this.sender}`]: 0 } // Ensure sender's count stays 0
    });
  } catch (err) {
    console.error('Error updating conversation lastMessage:', err);
  }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };
