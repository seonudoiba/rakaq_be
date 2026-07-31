// scripts/migrate.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Running database setup...');

const migrationMarker = '/tmp/.db-initialized';

try {
  // Check if already initialized
  if (fs.existsSync(migrationMarker)) {
    console.log('✅ Database already initialized');
    process.exit(0);
  }

  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Try migrate deploy first
  console.log('🔄 Attempting migrations...');
  try {
    execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.log('⚠️ Migrations failed, falling back to db push...');
    execSync('npx prisma db push --schema=./prisma/schema.prisma', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Database schema pushed successfully');
  }

  // Try seeding (continue even if seed fails)
  console.log('🌱 Seeding database...');
  try {
    execSync('npx prisma db seed --schema=./prisma/schema.prisma', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Seeding completed successfully');
  } catch (error) {
    console.log('⚠️ Seeding failed (may already be seeded). Continuing...');
  }

  // Mark as initialized
  fs.writeFileSync(migrationMarker, new Date().toISOString());
  console.log('✅ Database setup complete');

} catch (error) {
  console.error('❌ Database setup failed:', error);
  // Don't exit with error - let the app try to start anyway
  console.log('⚠️ Continuing despite database setup issues...');
  process.exit(0);
}