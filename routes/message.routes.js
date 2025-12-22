const express = require('express');
const router = express.Router();
const { Conversation, Message } = require('../models/message.model');
const User = require('../models/user.model');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');

// Get all conversations for the current user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status = 'active' } = req.query;

    const query = {
      participants: userId
    };

    if (status === 'active') {
      query.archivedBy = { $ne: userId };
    } else if (status === 'archived') {
      query.archivedBy = userId;
    }

    const conversations = await Conversation.find(query)
      .populate('participants', 'name email')
      .populate('property', 'address askingPrice images')
      .sort({ updatedAt: -1 });

    // Format response with unread counts
    const formattedConversations = conversations.map(conv => {
      const otherParticipants = conv.participants.filter(
        p => p._id.toString() !== userId
      );
      const unreadCount = conv.unreadCount?.get(userId) || 0;

      return {
        id: conv._id,
        participants: otherParticipants,
        property: conv.property ? {
          id: conv.property._id,
          address: conv.property.address?.street || 'N/A',
          city: conv.property.address?.city || '',
          price: conv.property.askingPrice,
          image: conv.property.images?.[0]
        } : null,
        lastMessage: conv.lastMessage,
        unreadCount,
        updatedAt: conv.updatedAt
      };
    });

    res.json(formattedConversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Start a new conversation or get existing one
router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { recipientId, propertyId, initialMessage } = req.body;
    const senderId = req.user.userId;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID required' });
    }

    if (recipientId === senderId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
      property: propertyId || null
    });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [senderId, recipientId],
        property: propertyId || undefined,
        unreadCount: new Map([[recipientId, 0], [senderId, 0]])
      });
      await conversation.save();
    }

    // If initial message provided, send it
    if (initialMessage && initialMessage.trim()) {
      const message = new Message({
        conversation: conversation._id,
        sender: senderId,
        content: initialMessage.trim(),
        type: 'text'
      });
      await message.save();

      // Update unread count for recipient
      const currentUnread = conversation.unreadCount?.get(recipientId) || 0;
      conversation.unreadCount.set(recipientId, currentUnread + 1);
      await conversation.save();
    }

    // Populate and return
    await conversation.populate('participants', 'name email');
    await conversation.populate('property', 'address askingPrice');

    res.status(201).json({
      id: conversation._id,
      participants: conversation.participants,
      property: conversation.property,
      createdAt: conversation.createdAt
    });
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Build query
    const query = {
      conversation: conversationId,
      deleted: false
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark messages as read
    const unreadMessages = messages.filter(m => {
      const isRead = m.readBy.some(r => r.userId.toString() === userId);
      return !isRead && m.sender._id.toString() !== userId;
    });

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessages.map(m => m._id) } },
        { $push: { readBy: { userId, readAt: new Date() } } }
      );

      // Reset unread count for this user
      conversation.unreadCount.set(userId, 0);
      await conversation.save();
    }

    // Return in chronological order
    res.json(messages.reverse().map(m => ({
      id: m._id,
      sender: m.sender,
      content: m.content,
      type: m.type,
      attachments: m.attachments,
      readBy: m.readBy,
      createdAt: m.createdAt,
      isOwn: m.sender._id.toString() === userId
    })));
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { content, type = 'text', attachments, metadata } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Create message
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content: content.trim(),
      type,
      attachments: attachments || [],
      metadata: metadata || {},
      readBy: [{ userId, readAt: new Date() }]
    });

    await message.save();

    // Update unread counts for other participants
    for (const participantId of conversation.participants) {
      if (participantId.toString() !== userId) {
        const currentUnread = conversation.unreadCount?.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentUnread + 1);
      }
    }
    await conversation.save();

    // Populate sender for response
    await message.populate('sender', 'name email');

    res.status(201).json({
      id: message._id,
      sender: message.sender,
      content: message.content,
      type: message.type,
      attachments: message.attachments,
      createdAt: message.createdAt,
      isOwn: true
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get unread message count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
      archivedBy: { $ne: userId }
    });

    let totalUnread = 0;
    for (const conv of conversations) {
      totalUnread += conv.unreadCount?.get(userId) || 0;
    }

    res.json({ unreadCount: totalUnread });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Archive a conversation
router.post('/conversations/:conversationId/archive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.archivedBy.includes(userId)) {
      conversation.archivedBy.push(userId);
      await conversation.save();
    }

    res.json({ message: 'Conversation archived' });
  } catch (err) {
    console.error('Error archiving conversation:', err);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

// Unarchive a conversation
router.post('/conversations/:conversationId/unarchive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.archivedBy = conversation.archivedBy.filter(
      id => id.toString() !== userId
    );
    await conversation.save();

    res.json({ message: 'Conversation unarchived' });
  } catch (err) {
    console.error('Error unarchiving conversation:', err);
    res.status(500).json({ error: 'Failed to unarchive conversation' });
  }
});

// Delete a message (soft delete)
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Start conversation with property owner
router.post('/contact-seller', authMiddleware, async (req, res) => {
  try {
    const { propertyId, message } = req.body;
    const buyerId = req.user.userId;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID required' });
    }

    // Get property and seller
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const sellerId = property.seller.toString();

    if (sellerId === buyerId) {
      return res.status(400).json({ error: 'Cannot message yourself about your own property' });
    }

    // Check for existing conversation about this property
    let conversation = await Conversation.findOne({
      participants: { $all: [buyerId, sellerId] },
      property: propertyId
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [buyerId, sellerId],
        property: propertyId,
        unreadCount: new Map([[sellerId, 0], [buyerId, 0]])
      });
      await conversation.save();
    }

    // Send initial message if provided
    if (message && message.trim()) {
      const newMessage = new Message({
        conversation: conversation._id,
        sender: buyerId,
        content: message.trim(),
        type: 'text',
        readBy: [{ userId: buyerId, readAt: new Date() }]
      });
      await newMessage.save();

      // Update unread count for seller
      const currentUnread = conversation.unreadCount?.get(sellerId) || 0;
      conversation.unreadCount.set(sellerId, currentUnread + 1);
      await conversation.save();
    }

    await conversation.populate('participants', 'name email');
    await conversation.populate('property', 'address askingPrice');

    res.status(201).json({
      id: conversation._id,
      property: conversation.property,
      message: 'Conversation started with seller'
    });
  } catch (err) {
    console.error('Error contacting seller:', err);
    res.status(500).json({ error: 'Failed to contact seller' });
  }
});

module.exports = router;
