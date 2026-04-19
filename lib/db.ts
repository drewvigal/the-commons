import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Tagged template literal — values are automatically parameterized (SQL injection safe).
// Usage: const rows = await sql`SELECT * FROM users WHERE id = ${userId}`
export const sql = neon(process.env.DATABASE_URL)
