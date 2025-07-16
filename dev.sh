#!/bin/bash
set -e

# Function to display usage
usage() {
    echo "Usage: $0 [backend|frontend|both]"
    echo "  backend  - Start only the Medusa backend"
    echo "  frontend - Start only the Next.js storefront"
    echo "  both     - Start both backend and frontend (default)"
    echo ""
    echo "Examples:"
    echo "  $0           # Start both"
    echo "  $0 backend   # Backend only"
    echo "  $0 frontend  # Frontend only"
    exit 1
}

# Parse command
COMMAND="${1:-both}"

case "$COMMAND" in
    backend|frontend|both)
        ;;
    -h|--help)
        usage
        ;;
    *)
        echo "Error: Invalid command '$COMMAND'"
        usage
        ;;
esac

# Function to start databases
start_databases() {
    echo "Starting databases..."
    docker compose -f compose.db.yaml up -d

    echo "Waiting for databases to be ready..."
    until docker compose -f compose.db.yaml exec postgres pg_isready -U medusa-starter > /dev/null 2>&1; do
        sleep 2
    done
    echo "Databases are ready!"
}

# Function to stop databases
stop_databases() {
    echo "Stopping databases..."
    docker compose -f compose.db.yaml down
}

# Function to start backend
start_backend() {
    echo "Starting Medusa backend..."
    cd backend

    # Run migrations first
    echo "Running database migrations..."
    npx medusa db:migrate
    echo "Database migrations completed"

    # Check if database is already seeded
    if PGPASSWORD=medusa-password psql -h localhost -U medusa-starter -d medusa-starter -t -c "SELECT COUNT(*) FROM api_key WHERE type = 'publishable';" 2>/dev/null | grep -q " 0"; then
        echo "Database not seeded, seeding with sample data..."
        npm run seed
        echo "Database seeding completed"
    else
        echo "Database already seeded, skipping seed step"
    fi

    npm run dev &
    BACKEND_PID=$!
    cd ..
    echo "Backend started at http://localhost:9000"
    echo "Admin dashboard at http://localhost:9000/app"
}

# Function to get or create publishable key
get_publishable_key() {
    echo "Fetching publishable key from backend..."

    # Wait for backend to be ready
    local retries=0
    while [ $retries -lt 30 ]; do
        if curl -s http://localhost:9000/health > /dev/null 2>&1; then
            break
        fi
        sleep 2
        retries=$((retries + 1))
    done

    # Wait additional time for admin user to be created
    echo "Waiting for admin user to be created..."
    sleep 5

    if [ $retries -eq 30 ]; then
        echo "Warning: Backend not ready after 60 seconds, using existing key"
        return
    fi

    # Get existing publishable key from database directly (seeded key)
    echo "Getting publishable key from database..."
    local key=$(PGPASSWORD=medusa-password psql -h localhost -U medusa-starter -d medusa-starter -t -c "SELECT token FROM api_key WHERE type = 'publishable' LIMIT 1;" 2>/dev/null | tr -d ' \n')

    if [ -z "$key" ]; then
        echo "No publishable key found in database, something went wrong with seeding"
        return
    fi

    if [ -n "$key" ]; then
        echo "Updating frontend .env.local with key: ${key:0:20}..."
        sed -i "s/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=.*/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$key/" storefront/.env.local
        echo "Publishable key updated successfully"
    else
        echo "Warning: Could not fetch/create publishable key"
    fi
}

# Function to start frontend
start_frontend() {
    echo "Starting Next.js storefront..."
    cd storefront
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo "Frontend started at http://localhost:8000"
}

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping services..."
    [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null || true
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    stop_databases

    echo "All services stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Ask user if they want to clean volumes at the start
echo ""
read -p "Do you want to clean database volumes before starting? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning database volumes..."
    docker compose -f compose.db.yaml down -v 2>/dev/null || true
    docker volume prune -f 2>/dev/null || true
    echo "Database volumes cleaned"
fi

# Start databases first
start_databases

# Start services based on command
case "$COMMAND" in
    backend)
        start_backend
        wait $BACKEND_PID
        ;;
    frontend)
        get_publishable_key
        start_frontend
        wait $FRONTEND_PID
        ;;
    both)
        start_backend
        sleep 3  # Wait for backend to start
        get_publishable_key
        start_frontend
        wait $BACKEND_PID $FRONTEND_PID
        ;;
esac
