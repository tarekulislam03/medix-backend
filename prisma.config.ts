import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
    earlyAccess: true,
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
    datasource: {
        url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_u1biswE5YKHp@ep-super-bird-af6rl515-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
});
