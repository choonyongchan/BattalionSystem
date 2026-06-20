import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

import { truncateTestDb, seedTestDb } from '../fixtures/db'

export default async function globalSetup() {
  await truncateTestDb()
  await seedTestDb()
}
