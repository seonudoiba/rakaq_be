# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Install bash and curl
RUN apk add --no-cache bash curl

RUN mkdir -p logs && chmod 777 logs

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/tsconfig.json ./
COPY --from=builder /usr/src/app/scripts ./scripts

# Make scripts executable
RUN chmod +x scripts/startup.sh scripts/db-setup.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

USER nodejs

EXPOSE 5000

CMD ["./scripts/startup.sh"]