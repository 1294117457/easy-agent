import type { Database } from 'better-sqlite3';
import type { Message } from '../../../domain/entities/Message.js';
import type { MessageRepository } from '../../ports/persistence/MessageRepository.js';

export class SQLiteMessageAdapter implements MessageRepository {
  constructor(private db: Database) {}

  async save(message: Message): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, model, created_at, is_compressed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.model || null,
        message.createdAt,
        message.isCompressed ? 1 : 0
      );
  }

  async saveMany(messages: Message[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, model, created_at, is_compressed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const message of messages) {
      stmt.run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.model || null,
        message.createdAt,
        message.isCompressed ? 1 : 0
      );
    }
  }

  async findById(id: string): Promise<Message | null> {
    const row = this.db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.rowToMessage(row);
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const rows = this.db
      .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
      .all(conversationId) as any[];
    return rows.map(row => this.rowToMessage(row));
  }

  async update(message: Message): Promise<void> {
    this.db
      .prepare(`UPDATE messages SET content = ?, is_compressed = ? WHERE id = ?`)
      .run(message.content, message.isCompressed ? 1 : 0, message.id);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    this.db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
  }

  async countByConversationId(conversationId: string): Promise<number> {
    const result = this.db
      .prepare(`SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`)
      .get(conversationId) as { count: number } | undefined;
    return result?.count || 0;
  }

  async markAsCompressed(messageId: string, summary: string): Promise<void> {
    this.db
      .prepare(`UPDATE messages SET content = ?, is_compressed = 1 WHERE id = ?`)
      .run(summary, messageId);
  }

  private rowToMessage(row: any): Message {
    return Message.fromJSON({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      model: row.model || undefined,
      createdAt: row.created_at,
      isCompressed: !!row.is_compressed,
    });
  }
}
