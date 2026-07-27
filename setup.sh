#!/bin/bash
# setup.sh - Full project setup script

echo "🚀 Setting up Rekaz Petroleum Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Setup Prisma
echo "🗄️ Setting up database..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  - Development: npm run dev"
echo "  - Production: npm start"
echo "  - Docker: docker-compose up -d"
echo ""
echo "📊 API Documentation: http://localhost:5000/api/v1/docs"