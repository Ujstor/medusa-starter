#!/bin/bash
set -e

# Default image names
DEFAULT_BACKEND_IMAGE="medusa-backend:latest"
DEFAULT_FRONTEND_IMAGE="medusa-frontend:latest"

# Function to display usage
usage() {
    echo "Usage: $0 [build|run|push] [options]"
    echo "Commands:"
    echo "  build - Only build the services (no startup)"
    echo "  run   - Build and run the services (default)"
    echo "  push  - Build and push images to registry"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG              Tag to use for built images"
    echo "  -b, --backend-image NAME   Full backend image name (default: $DEFAULT_BACKEND_IMAGE)"
    echo "  -f, --frontend-image NAME  Full frontend image name (default: $DEFAULT_FRONTEND_IMAGE)"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 run"
    echo "  $0 push -t v1.0.0"
    echo "  $0 build --tag latest"
    echo "  $0 push -b myregistry/medusa-backend:v1.0.0 -f myregistry/medusa-frontend:v1.0.0"
    echo "  $0 push -t v1.0.0  # Uses medusa-backend:v1.0.0 and medusa-frontend:v1.0.0"
    exit 1
}

# Parse command line arguments
COMMAND="run"
TAG=""
BACKEND_IMAGE=""
FRONTEND_IMAGE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        build|run|push)
            COMMAND="$1"
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -b|--backend-image)
            BACKEND_IMAGE="$2"
            shift 2
            ;;
        -f|--frontend-image)
            FRONTEND_IMAGE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Error: Unknown option '$1'"
            usage
            ;;
    esac
done

# Set image names based on provided options
if [ -n "$TAG" ]; then
    BACKEND_IMAGE=${BACKEND_IMAGE:-"medusa-backend:$TAG"}
    FRONTEND_IMAGE=${FRONTEND_IMAGE:-"medusa-frontend:$TAG"}
else
    BACKEND_IMAGE=${BACKEND_IMAGE:-$DEFAULT_BACKEND_IMAGE}
    FRONTEND_IMAGE=${FRONTEND_IMAGE:-$DEFAULT_FRONTEND_IMAGE}
fi

# Function to build backend services
build_backend_services() {
    echo "Building backend services..."
    docker compose build --no-cache postgres redis medusa-backend
    if [ $? -ne 0 ]; then
        echo "Failed to build backend services"
        exit 1
    fi

    # Tag backend image
    echo "Tagging backend image as: $BACKEND_IMAGE"
    # Get the actual built image name from docker compose
    BACKEND_BUILT_IMAGE=$(docker compose images medusa-backend -q | head -1)
    if [ -z "$BACKEND_BUILT_IMAGE" ]; then
        # Fallback to common naming pattern
        BACKEND_BUILT_IMAGE=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(medusa-backend|backend)" | head -1 | tr -d ' ')
    fi
    if [ -z "$BACKEND_BUILT_IMAGE" ]; then
        echo "Warning: Could not find backend image, using default name"
        BACKEND_BUILT_IMAGE="medusa-backend"
    fi
    docker tag $BACKEND_BUILT_IMAGE $BACKEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Failed to tag backend image"
        exit 1
    fi

    echo "Backend services built successfully!"
    echo "Backend image: $BACKEND_IMAGE"
}

# Function to build frontend (requires backend to be running)
build_frontend() {
    echo "Building frontend (Next.js)..."
    docker compose build --no-cache medusa-frontend
    if [ $? -ne 0 ]; then
        echo "Failed to build frontend"
        exit 1
    fi

    # Tag frontend image
    echo "Tagging frontend image as: $FRONTEND_IMAGE"
    # Get the actual built image name from docker compose
    FRONTEND_BUILT_IMAGE=$(docker compose images medusa-frontend -q | head -1)
    if [ -z "$FRONTEND_BUILT_IMAGE" ]; then
        # Fallback to common naming pattern
        FRONTEND_BUILT_IMAGE=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(medusa-frontend|frontend)" | head -1 | tr -d ' ')
    fi
    if [ -z "$FRONTEND_BUILT_IMAGE" ]; then
        echo "Warning: Could not find frontend image, using default name"
        FRONTEND_BUILT_IMAGE="medusa-frontend"
    fi
    docker tag $FRONTEND_BUILT_IMAGE $FRONTEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Failed to tag frontend image"
        exit 1
    fi

    echo "Frontend built successfully!"
    echo "Frontend image: $FRONTEND_IMAGE"
}

# Function to build all services
build_services() {
    build_backend_services

    # Start backend services to enable frontend build
    echo "Starting backend services for frontend build..."
    docker compose up -d postgres redis medusa-backend
    if [ $? -ne 0 ]; then
        echo "Failed to start backend services"
        exit 1
    fi

    echo "Waiting for backend to be healthy..."
    until curl -f http://localhost:9000/health > /dev/null 2>&1; do
        echo "Waiting for backend server..."
        sleep 5
    done

    echo "Backend is healthy, building frontend..."
    build_frontend

    # Stop backend services after frontend build (they'll be restarted in run_services if needed)
    echo "Stopping backend services after frontend build..."
    docker compose down

    echo "All services built successfully!"
}

push_images() {
    echo "Pushing images..."

    # Push backend image
    echo "Pushing $BACKEND_IMAGE..."
    docker push $BACKEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Failed to push $BACKEND_IMAGE"
        exit 1
    fi

    # Push frontend image
    echo "Pushing $FRONTEND_IMAGE..."
    docker push $FRONTEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Failed to push $FRONTEND_IMAGE"
        exit 1
    fi

    echo "All images pushed successfully!"
}

run_services() {
    echo "Starting backend services..."
    docker compose up -d postgres redis medusa-backend
    if [ $? -ne 0 ]; then
        echo "Failed to start backend services"
        exit 1
    fi

    echo "Waiting for backend to be healthy..."
    until curl -f http://localhost:9000/health > /dev/null 2>&1; do
        echo "Waiting for backend server..."
        sleep 5
    done

    echo "Backend is healthy, starting frontend..."
    docker compose up medusa-frontend
    if [ $? -ne 0 ]; then
        echo "Failed to start frontend"
        exit 1
    fi
}

case "$COMMAND" in
    build)
        build_services
        ;;
    run)
        build_services
        run_services
        ;;
    push)
        build_services
        push_images
        ;;
    *)
        echo "Error: Invalid command '$COMMAND'"
        usage
        ;;
esac
