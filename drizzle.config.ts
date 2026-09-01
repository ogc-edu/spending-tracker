import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // Expo driver: drizzle-kit also emits drizzle/migrations.js (bundle of .sql
  // imports) consumed by the migrator at app startup — plan 002, plan file layout.
  driver: 'expo',
});