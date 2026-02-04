import * as path from 'path';
import * as fs from 'fs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const schemaPath = path.join(process.cwd(), '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  const conn = await mysql.createConnection({
    uri: DATABASE_URL,
    multipleStatements: true,
  } as mysql.ConnectionOptions);
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (stmt) await conn.query(stmt);
  }
  await conn.end();
  console.log('Migration completed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
