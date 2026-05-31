import type { Conversation } from '../../../domain/entities/Conversation.js';

export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findById(id: string): Promise<Conversation | null>;
  findAll(): Promise<Conversation[]>;
  delete(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  touch(id: string): Promise<void>;
  compress(id: string, summary: string): Promise<void>;
  end(id: string, title: string): Promise<void>;
  getMessageCount(convId: string): Promise<number>;
}
