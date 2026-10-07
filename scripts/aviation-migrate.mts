import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
const url = process.env.HRL_DATABASE_URL_UNPOOLED
if (!url) throw new Error('HRL_DATABASE_URL_UNPOOLED is required')
const sql = neon(url)
const source = await readFile(new URL('../db/001_aviation.sql', import.meta.url), 'utf8')
const functionStart = source.indexOf('CREATE OR REPLACE FUNCTION')
const statements = source.slice(0, functionStart).split(/;\s*\n/).filter(part => part.trim() && !part.trim().startsWith('--'))
await sql.transaction([...statements, source.slice(functionStart)].map(statement => sql.query(statement)))
console.log('Aviation schema applied successfully.')
