#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Running database seed..."
npx prisma db seed || echo "Seed already applied or skipped"

echo "Starting application..."
exec node dist/main.js
