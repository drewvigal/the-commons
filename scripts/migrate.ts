/**
 * Idempotent migration runner.
 *
 * - Reads all .sql files from /migrations in lexicographic order
 * - Tracks applied migrations in the schema_migrations table
 * - Skips files that have already been applied
 * - Safe to re-run at any time
 *
 * Usage:
 *   npm run migrate
 *   # or:
 *   npx tsx scripts/migrate.ts
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load .env.local for local development
dotenv.config({ path: '.env.local' })

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
  }

  // Use WebSocket-based Pool for Node.js — supports multi-statement SQL strings.
  // The HTTP tagged-template driver executes one statement per call, which
  // makes it unsuitable for running full migration files.
  const { Pool, neonConfig } = await import('@neondatabase/serverless')
  const { default: ws } = await import('ws')
  neonConfig.webSocketConstructor = ws

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Ensure the tracking table exists before we query it
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    // Fetch already-applied migrations
    const { rows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    )
    const applied = new Set(rows.map(r => r.filename))

    // Read migration files sorted lexicographically (001_, 002_, ...)
    const migrationsDir = join(process.cwd(), 'migrations')
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('No migration files found in /migrations')
      return
    }

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`  skip  ${filename}`)
        continue
      }

      console.log(`  apply ${filename} ...`)
      const sql = readFileSync(join(migrationsDir, filename), 'utf8')

      // Run the migration file and record it atomically
      await pool.query('BEGIN')
      try {
        await pool.query(sql)
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        )
        await pool.query('COMMIT')
        console.log(`  done  ${filename}`)
      } catch (err) {
        await pool.query('ROLLBACK')
        throw err
      }
    }

    console.log('\nMigrations complete.')
  } finally {
    await pool.end()
  }
}

runMigrations().catch(err => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
