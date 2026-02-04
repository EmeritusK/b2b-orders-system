import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const seedPath = path.join(process.cwd(), '..', 'db', 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf-8');

  const conn = await mysql.createConnection({
    uri: DATABASE_URL as any, 
    multipleStatements: true,
  } as any);

  try {
    await conn.beginTransaction();
    await conn.query(sql);
    await conn.commit();
    console.log('Seed completed');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
