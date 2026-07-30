#!/bin/bash

echo "🚀 Starting application..."

# Run database setup in the background
(
  echo "📦 Generating Prisma client..."
  npx prisma generate

  echo "🔄 Running database migrations..."
  npx prisma migrate deploy --schema=./prisma/schema.prisma

  echo "🌱 Seeding database..."
  npx prisma db seed --schema=./prisma/schema.prisma

  echo "✅ Database setup complete!"
) &

# Start the server immediately
echo "✅ Starting server..."
exec npx tsx src/server.ts