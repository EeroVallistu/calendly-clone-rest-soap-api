#!/bin/bash

# Exit on any error
set -e

# Define script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Go to soap service directory
cd "$PROJECT_ROOT/src/soap-service"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the SOAP service
echo "Starting SOAP service..."
npm start 