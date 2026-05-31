import type { Database } from 'better-sqlite3';
import type { Prompt } from '../../../domain/entities/Prompt.js';
import type { PromptRepository } from '../../ports/persistence/PromptRepository.js';

export class SQLitePromptAdapter implements PromptRepository {
  constructor(private db: Database) {}

  async save(prompt: Prompt): Promise<void> {
    const json = prompt.toJSON();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO prompts (id, name, description, system_prompt, is_builtin, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        json.id,
        json.name,
        json.description || '',
        json.systemPrompt,
        json.isBuiltin ? 1 : 0,
        json.isActive ? 1 : 0,
        json.createdAt,
        json.updatedAt
      );
  }

  async findById(id: string): Promise<Prompt | null> {
    const row = this.db.prepare(`SELECT * FROM prompts WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.rowToPrompt(row);
  }

  async findAll(): Promise<Prompt[]> {
    const rows = this.db
      .prepare(`SELECT * FROM prompts ORDER BY is_builtin DESC, is_active DESC, created_at DESC`)
      .all() as any[];
    return rows.map(row => this.rowToPrompt(row));
  }

  async findActive(): Promise<Prompt | null> {
    const row = this.db.prepare(`SELECT * FROM prompts WHERE is_active = 1 LIMIT 1`).get() as any;
    if (!row) return null;
    return this.rowToPrompt(row);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id).changes > 0;
  }

  async deactivateAll(): Promise<void> {
    this.db.prepare(`UPDATE prompts SET is_active = 0`).run();
  }

  async setActive(id: string): Promise<void> {
    await this.deactivateAll();
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE prompts SET is_active = 1, updated_at = ? WHERE id = ?`).run(now, id);
  }

  private rowToPrompt(row: any): Prompt {
    return Prompt.fromJSON({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      systemPrompt: row.system_prompt,
      isBuiltin: !!row.is_builtin,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
