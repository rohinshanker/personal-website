import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

class SqliteD1Statement {
  constructor(database, sql, params = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new SqliteD1Statement(this.database, this.sql, params);
  }

  async all() {
    return { results: this.database.sqlite.prepare(this.sql).all(...this.params) };
  }

  async first(columnName) {
    const row = this.database.sqlite.prepare(this.sql).get(...this.params) ?? null;
    return columnName && row ? row[columnName] : row;
  }

  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.params);
    return {
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

export class SqliteD1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
  }

  prepare(sql) {
    return new SqliteD1Statement(this, sql);
  }

  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) {
        if (/^\s*(?:WITH|SELECT|PRAGMA|EXPLAIN)\b/i.test(statement.sql)) {
          results.push(await statement.all());
        } else {
          results.push(await statement.run());
        }
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql) {
    this.sqlite.exec(sql);
  }

  close() {
    this.sqlite.close();
  }
}

export const applyGameStatsMigrations = (database, migrationPaths) => {
  for (const migrationPath of migrationPaths) {
    database.exec(readFileSync(migrationPath, "utf8"));
  }
};
