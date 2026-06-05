import type { Message } from '../../domain/entities/Message.js';

export interface MessageRepository {
  save(message: Message): Promise<void>;
  saveMany(messages: Message[]): Promise<void>;
  findById(id: string): Promise<Message | null>;
  findByConversationId(conversationId: string): Promise<Message[]>;
  update(message: Message): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByConversationId(conversationId: string): Promise<void>;
  countByConversationId(conversationId: string): Promise<number>;
  markAsCompressed(messageId: string, summary: string): Promise<void>;
}
