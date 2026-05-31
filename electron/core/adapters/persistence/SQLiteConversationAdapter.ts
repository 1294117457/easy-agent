import type { Database } from 'better-sqlite3';
import type { Conversation } from '../../../domain/entities/Conversation.js';
import type { ConversationRepository } from '../../ports/persistence/ConversationRepository.js';
import { SQLiteMessageAdapter } from './SQLiteMessageAdapter.js';

export class SQLiteConversationAdapter implements ConversationRepository {
  constructor(
    private db: Database,
    private messageAdapter: SQLiteMessageAdapter
  ) {}

  async save(conversation: Conversation): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO conversations (id, name, workflow_id, summary, ended_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        conversation.id,
        conversation.name,
        conversation.workflowId || null,
        conversation.summary || null,
        conversation.endedAt || null,
        conversation.createdAt,
        conversation.updatedAt
      );
  }

  async findById(id: string): Promise<Conversation | null> {
    const row = this.db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as any;
    if (!row) return null;

    const messages = await this.messageAdapter.findByConversationId(id);
    return this.rowToConversation(row, messages);
  }

  async findAll(): Promise<Conversation[]> {
    const rows = this.db
      .prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`)
      .all() as any[];
    return rows.map(row => this.rowToConversation(row));
  }

  async delete(id: string): Promise<void> {
    await this.messageAdapter.deleteByConversationId(id);
    this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  }

  async rename(id: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name, now, id);
  }

  async touch(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, id);
  }

  async compress(id: string, summary: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE conversations SET summary = ?, updated_at = ? WHERE id = ?`)
      .run(summary, now, id);
  }

  async end(id: string, title: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE conversations SET name = ?, ended_at = ?, updated_at = ? WHERE id = ?`)
      .run(title, now, now, id);
  }

  async getMessageCount(convId: string): Promise<number> {
    return this.messageAdapter.countByConversationId(convId);
  }

  private rowToConversation(row: any, messages: any[] = []): Conversation {
    return Conversation.fromJSON({
      id: row.id,
      name: row.name || '新对话',
      workflowId: row.workflow_id || undefined,
      summary: row.summary || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      endedAt: row.ended_at || undefined,
      status: row.ended_at ? 'completed' as const : 'idle' as const,
      messageCount: 0,
    }, messages);
  }
}
