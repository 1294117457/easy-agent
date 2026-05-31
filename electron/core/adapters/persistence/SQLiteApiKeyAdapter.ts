import type { Database } from 'better-sqlite3';
import type { ApiKey } from '../../../domain/entities/ApiKey.js';
import type { ApiKeyRepository } from '../../ports/persistence/ApiKeyRepository.js';

export class SQLiteApiKeyAdapter implements ApiKeyRepository {
  constructor(
    private db: Database,
    private decryptor: (encrypted: string) => string
  ) {}

  async save(apiKey: ApiKey, encryptedKey: string): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO api_keys (id, provider, encrypted_key, model, base_url, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        apiKey.id,
        apiKey.provider,
        encryptedKey,
        apiKey.model,
        apiKey.baseURL || null,
        apiKey.enabled ? 1 : 0,
        apiKey.createdAt
      );
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = this.db.prepare(`SELECT * FROM api_keys WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.rowToApiKey(row);
  }

  async findAll(): Promise<ApiKey[]> {
    const rows = this.db.prepare(`SELECT * FROM api_keys`).all() as any[];
    return rows.map(row => this.rowToApiKey(row));
  }

  async findEnabled(): Promise<ApiKey[]> {
    const rows = this.db.prepare(`SELECT * FROM api_keys WHERE enabled = 1`).all() as any[];
    return rows.map(row => this.rowToApiKey(row));
  }

  async findByProvider(provider: string): Promise<ApiKey[]> {
    const rows = this.db.prepare(`SELECT * FROM api_keys WHERE provider = ?`).all(provider) as any[];
    return rows.map(row => this.rowToApiKey(row));
  }

  async delete(id: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id).changes > 0;
  }

  async getDecryptedKey(id: string): Promise<string | null> {
    const row = this.db.prepare(`SELECT encrypted_key FROM api_keys WHERE id = ?`).get(id) as any;
    if (!row) return null;
    try {
      return this.decryptor(row.encrypted_key);
    } catch {
      return null;
    }
  }

  private rowToApiKey(row: any): ApiKey {
    return ApiKey.fromJSON({
      id: row.id,
      provider: row.provider,
      model: row.model,
      baseURL: row.base_url || undefined,
      enabled: !!row.enabled,
      createdAt: row.created_at,
    });
  }
}
