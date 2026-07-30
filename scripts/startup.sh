#!/bin/bash

echo "🚀 Starting application..."

# Check if database is already set up
if [ -f "/usr/src/app/.db-initialized" ]; then
    echo "✅ Database already initialized. Starting server..."
    exec npx tsx src/server.ts
fi

echo "⏳ First time setup - initializing database..."
(
  echo "📦 Generating Prisma client..."
  npx prisma generate 2>&1

  echo "🔄 Running database migrations..."
  npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1

  echo "🌱 Seeding database..."
  npx prisma db seed --schema=./prisma/schema.prisma 2>&1

  # Mark as initialized
  touch /usr/src/app/.db-initialized
  
  echo "✅ Database setup complete at $(date)"
) > /usr/src/app/logs/db-setup.log 2>&1 &

# Start the server immediately
echo "✅ Starting server on port ${PORT:-5000}..."
exec npx tsx src/server.ts