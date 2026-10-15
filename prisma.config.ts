import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  datasource: {
    // CLI (migrate/studio) needs a session connection; Supabase's pooled 6543 URL can't run migrations.
    // No throw when unset: `prisma generate` (postinstall/build) needs no database.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
});
