#!/bin/bash

echo "🚀 Running database setup..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Seed the database
echo "🌱 Seeding database..."
npx prisma db seed --schema=./prisma/schema.prisma

# Create marker file
touch /usr/src/app/.db-initialized

echo "✅ Database setup complete!"