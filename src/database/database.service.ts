import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface PopulateSpec {
  as: string;
  table: string;
  ref: string;
  select?: string[];
  nested?: PopulateSpec[];
}

export interface FindOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  offset?: number;
  select?: string[];
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    this.pool = new Pool({ connectionString: url });
  }

  async onModuleInit() {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log('PostgreSQL connection established');
    } catch (error) {
      this.logger.error('PostgreSQL connection failed:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows as T[];
  }

  async get<T = any>(text: string, params: any[] = []): Promise<T | null> {
    const res = await this.pool.query(text, params);
    return (res.rows[0] as T) || null;
  }

  async run(text: string, params: any[] = []): Promise<void> {
    await this.pool.query(text, params);
  }

  // ─────────────────────────────────────────────
  // Generic CRUD (models mirror Mongoose documents:
  // primary key "_id", timestamps createdAt/updatedAt)
  // ─────────────────────────────────────────────

  async find(
    table: string,
    where: Record<string, any> = {},
    options: FindOptions = {},
  ): Promise<any[]> {
    const { clauses, params } = this.buildWhere(where);
    let sql = `SELECT * FROM "${table}"`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    if (options.sort && Object.keys(options.sort).length) {
      const orderBy = Object.entries(options.sort).map(([col, dir]) => {
        const order = dir === -1 ? 'DESC' : 'ASC';
        return `"${col}" ${order}`;
      });
      sql += ` ORDER BY ${orderBy.join(', ')}`;
    }
    if (options.limit) sql += ` LIMIT ${options.limit}`;
    if (options.offset) sql += ` OFFSET ${options.offset}`;
    return this.query(sql, params);
  }

  async findOne(
    table: string,
    where: Record<string, any> = {},
  ): Promise<any | null> {
    const { clauses, params } = this.buildWhere(where);
    let sql = `SELECT * FROM "${table}"`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    sql += ' LIMIT 1';
    return this.get(sql, params);
  }

  async findById(table: string, id: string | number): Promise<any | null> {
    return this.findOne(table, { _id: id });
  }

  async create(table: string, data: Record<string, any>): Promise<any> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    const cols = entries.map(([c]) => `"${c}"`);
    const placeholders = entries.map((_, i) => `$${i + 1}`);
    const values = entries.map(([, v]) => this.toDbValue(v));
    const sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    return this.get(sql, values);
  }

  async update(
    table: string,
    id: string | number,
    data: Record<string, any>,
  ): Promise<any | null> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (!entries.length) return this.findById(table, id);
    const sets = entries.map(([c], i) => `"${c}" = $${i + 1}`);
    const values = entries.map(([, v]) => this.toDbValue(v));
    values.push(id);
    const sql = `UPDATE "${table}" SET ${sets.join(', ')}, "updatedAt" = now() WHERE "_id" = $${values.length} RETURNING *`;
    return this.get(sql, values);
  }

  async updateWhere(
    table: string,
    where: Record<string, any>,
    data: Record<string, any>,
  ): Promise<void> {
    const { clauses, params } = this.buildWhere(where);
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    const sets = entries.map(([c], i) => `"${c}" = $${params.length + i + 1}`);
    const values = [...params, ...entries.map(([, v]) => this.toDbValue(v))];
    let sql = `UPDATE "${table}" SET ${sets.join(', ')}, "updatedAt" = now()`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    await this.run(sql, values);
  }

  async delete(table: string, id: string | number): Promise<boolean> {
    const sql = `DELETE FROM "${table}" WHERE "_id" = $1`;
    const res = await this.pool.query(sql, [id]);
    return (res.rowCount || 0) > 0;
  }

  async count(table: string, where: Record<string, any> = {}): Promise<number> {
    const { clauses, params } = this.buildWhere(where);
    let sql = `SELECT COUNT(*)::int AS cnt FROM "${table}"`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    const row = await this.get(sql, params);
    return row ? row.cnt : 0;
  }

  async sum(
    table: string,
    column: string,
    where: Record<string, any> = {},
  ): Promise<number> {
    const { clauses, params } = this.buildWhere(where);
    let sql = `SELECT COALESCE(SUM("${column}"), 0)::float8 AS total FROM "${table}"`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    const row = await this.get(sql, params);
    return row ? row.total : 0;
  }

  // Group-by returning mongoose-aggregate-style [{ _id, count }]
  async groupBy(
    table: string,
    column: string,
    match: Record<string, any> = {},
  ): Promise<Array<{ _id: string; count: number }>> {
    const { clauses, params } = this.buildWhere(match);
    let sql = `SELECT "${column}"::text AS _id, COUNT(*)::int AS count FROM "${table}"`;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    sql += ` GROUP BY "${column}"`;
    const rows = await this.query(sql, params);
    return rows.map((r) => ({ _id: r._id ?? '', count: r.count }));
  }

  // Populates reference columns (e.g. patientId -> row, optionally nested userId -> row)
  async populate(rows: any[], spec: PopulateSpec): Promise<any[]> {
    if (!rows.length) return rows;
    const ids = Array.from(
      new Set(rows.map((r) => r[spec.ref]).filter((id) => id !== null && id !== undefined)),
    );
    if (!ids.length) {
      rows.forEach((r) => (r[spec.as] = null));
      return rows;
    }

    const select = spec.select?.length
      ? ['_id', ...spec.select].map((c) => `"${c}"`).join(', ')
      : '*';
    const placeholders = ids.map((_, i) => `$${i + 1}`);
    const related = await this.query(
      `SELECT ${select} FROM "${spec.table}" WHERE "_id" IN (${placeholders.join(', ')})`,
      ids,
    );

    const map = new Map(related.map((r) => [String(r._id), r]));
    for (const row of rows) {
      const found = row[spec.ref] != null ? map.get(String(row[spec.ref])) : undefined;
      row[spec.as] = found ?? null;
    }

    if (spec.nested?.length) {
      for (const nested of spec.nested) {
        const withRows = rows.map((r) => r[spec.as]).filter((r) => r);
        if (withRows.length) await this.populate(withRows, nested);
      }
    }
    return rows;
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private toDbValue(v: any): any {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
      return JSON.stringify(v);
    }
    return v;
  }

  private buildWhere(where: Record<string, any>): {
    clauses: string[];
    params: any[];
  } {
    const params: any[] = [];
    const addParam = (v: any): string => {
      params.push(this.toDbValue(v));
      return `$${params.length}`;
    };

    const build = (condition: Record<string, any>): string[] => {
      const clauses: string[] = [];
      for (const key of Object.keys(condition)) {
        const value = condition[key];
        const col = `"${key}"`;

        if (key === '$or') {
          const orClauses: string[] = [];
          for (const sub of value as Array<Record<string, any>>) {
            const subClauses = build(sub);
            if (subClauses.length) {
              orClauses.push(`(${subClauses.join(' AND ')})`);
            }
          }
          if (orClauses.length) clauses.push(orClauses.join(' OR '));
          continue;
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [op, opVal] of Object.entries(value)) {
            switch (op) {
              case '$ne':
                clauses.push(`${col} <> ${addParam(opVal)}`);
                break;
              case '$in':
                clauses.push(`${col} IN (${(opVal as any[]).map((x) => addParam(x)).join(', ')})`);
                break;
              case '$nin':
                clauses.push(`${col} NOT IN (${(opVal as any[]).map((x) => addParam(x)).join(', ')})`);
                break;
              case '$gt':
                clauses.push(`${col} > ${addParam(opVal)}`);
                break;
              case '$gte':
                clauses.push(`${col} >= ${addParam(opVal)}`);
                break;
              case '$lt':
                clauses.push(`${col} < ${addParam(opVal)}`);
                break;
              case '$lte':
                clauses.push(`${col} <= ${addParam(opVal)}`);
                break;
              case '$regex':
                clauses.push(`${col}::text ILIKE ${addParam(`%${opVal}%`)}`);
                break;
              default:
                clauses.push(`${col} = ${addParam(opVal)}`);
            }
          }
          continue;
        }

        clauses.push(`${col} = ${addParam(value)}`);
      }
      return clauses;
    };

    return { clauses: build(where), params };
  }
}