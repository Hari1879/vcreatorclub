import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * Thin wrapper over node-postgres. Every query is parameterised
 * ($1, $2 …) — user input is never concatenated into SQL text.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 10,
    });
  }

  async query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
    const res = await this.pool.query<T>(text, params);
    return res.rows;
  }

  async one<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
