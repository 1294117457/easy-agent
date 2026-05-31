import type { Database } from 'better-sqlite3';
import type { McpServer } from '../../../domain/entities/McpServer.js';
import type { McpServerRepository } from '../../ports/persistence/McpServerRepository.js';

export class SQLiteMcpServerAdapter implements McpServerRepository {
  constructor(private db: Database) {}

  async save(server: McpServer): Promise<void> {
    const json = server.toJSON();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO mcp_servers (id, name, type, command, url, headers, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        json.id,
        json.name,
        json.type,
        json.command || null,
        json.url || null,
        JSON.stringify(json.headers || {}),
        json.enabled ? 1 : 0,
        json.createdAt
      );
  }

  async saveMany(servers: McpServer[]): Promise<void> {
    for (const server of servers) {
      await this.save(server);
    }
  }

  async findById(id: string): Promise<McpServer | null> {
    const row = this.db.prepare(`SELECT * FROM mcp_servers WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.rowToMcpServer(row);
  }

  async findAll(): Promise<McpServer[]> {
    const rows = this.db.prepare(`SELECT * FROM mcp_servers`).all() as any[];
    return rows.map(row => this.rowToMcpServer(row));
  }

  async findConnected(): Promise<McpServer[]> {
    const all = await this.findAll();
    return all.filter(s => s.isConnected);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM mcp_servers WHERE id = ?`).run(id);
  }

  private rowToMcpServer(row: any): McpServer {
    let headers: Record<string, string> = {};
    let env: Record<string, string> = {};
    let args: string[] = [];
    if (row.headers) {
      try { headers = JSON.parse(row.headers); } catch {}
    }
    if (row.env) {
      try { env = JSON.parse(row.env); } catch {}
    }
    if (row.args) {
      try { args = JSON.parse(row.args); } catch {}
    }
    return McpServer.fromJSON({
      id: row.id,
      name: row.name,
      type: row.type,
      command: row.command || undefined,
      args,
      env,
      url: row.url || undefined,
      headers,
      enabled: !!row.enabled,
      status: 'disconnected',
      createdAt: row.created_at,
      updatedAt: row.created_at,
    });
  }
}
