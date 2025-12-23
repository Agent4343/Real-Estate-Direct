/**
 * Messaging Tests
 * Tests for conversation and message functionality
 */

describe('Messaging System', () => {
  describe('Conversation Validation', () => {
    const validateNewConversation = (data) => {
      const errors = [];

      if (!data.recipientId) errors.push('Recipient is required');
      if (!data.propertyId && !data.message) {
        errors.push('Either property or initial message is required');
      }

      return errors;
    };

    it('should require recipient', () => {
      const errors = validateNewConversation({ message: 'Hello' });
      expect(errors).toContain('Recipient is required');
    });

    it('should require property or message', () => {
      const errors = validateNewConversation({ recipientId: '123' });
      expect(errors).toContain('Either property or initial message is required');
    });

    it('should accept valid conversation data', () => {
      const errors = validateNewConversation({
        recipientId: '123',
        propertyId: '456',
        message: 'Hello'
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('Message Validation', () => {
    const validateMessage = (content) => {
      if (!content) return 'Message cannot be empty';
      if (typeof content !== 'string') return 'Message must be text';
      if (content.trim().length === 0) return 'Message cannot be empty';
      if (content.length > 10000) return 'Message too long';
      return null;
    };

    it('should reject empty message', () => {
      expect(validateMessage('')).toBe('Message cannot be empty');
      expect(validateMessage('   ')).toBe('Message cannot be empty');
    });

    it('should reject too long message', () => {
      const longMessage = 'a'.repeat(10001);
      expect(validateMessage(longMessage)).toBe('Message too long');
    });

    it('should accept valid message', () => {
      expect(validateMessage('Hello, I am interested in your property')).toBeNull();
    });
  });

  describe('Conversation Sorting', () => {
    const conversations = [
      { id: 1, lastMessageAt: new Date('2024-01-15') },
      { id: 2, lastMessageAt: new Date('2024-01-20') },
      { id: 3, lastMessageAt: new Date('2024-01-10') }
    ];

    it('should sort conversations by most recent first', () => {
      const sorted = [...conversations].sort((a, b) =>
        new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
      );

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });
  });

  describe('Unread Count', () => {
    it('should calculate unread messages correctly', () => {
      const messages = [
        { id: 1, read: true },
        { id: 2, read: false },
        { id: 3, read: false },
        { id: 4, read: true }
      ];

      const unreadCount = messages.filter(m => !m.read).length;
      expect(unreadCount).toBe(2);
    });
  });
});
