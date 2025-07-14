#!/bin/bash

# Start backend services first
echo "Starting backend services..."
docker compose up -d postgres redis backend-server

# Wait for backend to be healthy
echo "Waiting for backend to be healthy..."
until curl -f http://localhost:9000/health > /dev/null 2>&1; do
  echo "Waiting for backend server..."
  sleep 5
done

echo "Backend is healthy, building frontend..."
# Now build and start frontend
docker compose up --build frontend
