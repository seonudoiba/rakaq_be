#!/bin/sh

echo "🚀 Starting application..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed database (only if needed - check if tables are empty)
echo "🌱 Seeding database..."
npx prisma db seed

# Start the application
echo "✅ Starting server..."
exec npx tsx src/server.ts