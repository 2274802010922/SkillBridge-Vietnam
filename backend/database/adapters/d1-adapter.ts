import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  createClient,
  type Client,
  type InStatement,
  type InValue,
  type ResultSet,
} from "@libsql/client";

function plainRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !/^\d+$/.test(key)),
  );
}

function d1Result<T>(result: ResultSet) {
  return {
    success: true,
    results: result.rows.map((row) => plainRow(row as Record<string, unknown>)) as T[],
    meta: {
      duration: 0,
      changes: result.rowsAffected,
      last_row_id: result.lastInsertRowid?.toString() ?? null,
      changed_db: result.rowsAffected > 0,
      size_after: 0,
      rows_read: result.rows.length,
      rows_written: result.rowsAffected,
    },
  };
}

class LibsqlPreparedStatement {
  private readonly client: Client;
  readonly sql: string;
  readonly args: InValue[];

  constructor(client: Client, sql: string, args: InValue[] = []) {
    this.client = client;
    this.sql = sql;
    this.args = args;
  }

  bind(...values: unknown[]) {
    return new LibsqlPreparedStatement(
      this.client,
      this.sql,
      values.map((value) => (value === undefined ? null : value)) as InValue[],
    );
  }

  toStatement(): InStatement {
    return { sql: this.sql, args: this.args };
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.client.execute(this.toStatement());
    const row = result.rows[0];
    if (!row) return null;
    if (columnName) return (row as Record<string, unknown>)[columnName] as T;
    return plainRow(row as Record<string, unknown>) as T;
  }

  async all<T = Record<string, unknown>>() {
    return d1Result<T>(await this.client.execute(this.toStatement()));
  }

  async run() {
    return d1Result(await this.client.execute(this.toStatement()));
  }

  async raw<T = unknown[]>() {
    const result = await this.client.execute(this.toStatement());
    return result.rows.map((row) => Array.from(row)) as T[];
  }
}

class LibsqlD1Database {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  prepare(sql: string) {
    return new LibsqlPreparedStatement(this.client, sql);
  }

  async batch(statements: LibsqlPreparedStatement[]) {
    const results = await this.client.batch(
      statements.map((statement) => statement.toStatement()),
      "write",
    );
    return results.map((result) => d1Result(result));
  }

  async exec(sql: string) {
    await this.client.executeMultiple(sql);
    return { count: 0, duration: 0 };
  }
}

let database: D1Database | null = null;

export function getDatabase(): D1Database {
  if (database) return database;
  const configuredUrl = process.env.TURSO_DATABASE_URL?.trim();
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel && !configuredUrl) {
    throw new Error(
      "TURSO_DATABASE_URL chưa được cấu hình cho Vercel. Hãy kết nối Turso trong Vercel Storage.",
    );
  }

  const url = configuredUrl || "file:.data/skillbridge.db";
  if (url.startsWith("file:")) {
    mkdirSync(path.resolve(process.cwd(), ".data"), { recursive: true });
  }
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  database = new LibsqlD1Database(client) as unknown as D1Database;
  return database;
}

export function createMemoryDatabaseForTests() {
  const client = createClient({ url: ":memory:" });
  return new LibsqlD1Database(client) as unknown as D1Database;
}
export function createIsolatedDatabaseForTests(url:string){
  if(!url.startsWith("file:")&&url!==":memory:")throw new Error("Test database must be local");
  const client=createClient({url});return {db:new LibsqlD1Database(client) as unknown as D1Database,close:()=>client.close()};
}
