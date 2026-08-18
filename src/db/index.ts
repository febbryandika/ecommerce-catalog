import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as authSchema from './auth-schema'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

// The schema is attached here rather than at each call site: Better Auth's Drizzle adapter
// resolves its models ("user", "session", …) through it, and it is what makes the relations
// in auth-schema.ts usable via db.query.
export const db = drizzle(new Pool({ connectionString }), {
  schema: { ...schema, ...authSchema },
})
