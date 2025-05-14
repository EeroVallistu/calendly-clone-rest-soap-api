#!/bin/bash

# Exit on any error
set -e

# Define script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "==============================================="
echo "Starting Calendly Clone APIs (SOAP and REST)"
echo "==============================================="

# Check for REST API files in the root directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "ERROR: REST API package.json not found at $PROJECT_ROOT"
  echo "Make sure the REST API is properly set up."
  exit 1
fi

# Check for SOAP service directory
if [ ! -d "$PROJECT_ROOT/src/soap-service" ]; then
  echo "ERROR: SOAP service directory not found at $PROJECT_ROOT/src/soap-service"
  echo "Make sure the SOAP service is properly set up."
  exit 1
fi

# Install dependencies for REST API if needed
echo "Setting up REST API..."
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ]; then
  echo "Installing REST API dependencies..."
  npm install
fi

# Start REST API in the background
echo "Starting REST API on port 3002..."
npm start &
REST_PID=$!
echo "REST API started with PID: $REST_PID"

# Small delay to ensure REST API has time to start
sleep 5

# Install dependencies for SOAP service if needed
echo "Setting up SOAP service..."
cd "$PROJECT_ROOT/src/soap-service"
if [ ! -d "node_modules" ]; then
  echo "Installing SOAP service dependencies..."
  npm install
fi

# Start SOAP service
echo "Starting SOAP service on port 3001..."
npm start &
SOAP_PID=$!
echo "SOAP service started with PID: $SOAP_PID"

# Set up trap to kill both processes on script termination
trap "echo 'Shutting down services...'; kill $REST_PID $SOAP_PID 2>/dev/null" EXIT INT TERM

echo "==============================================="
echo "Both services are now running:"
echo "- REST API: http://localhost:3002"
echo "- SOAP API: http://localhost:3001/soap"
echo "- WSDL: http://localhost:3001/wsdl/calendly-soap-service.wsdl"
echo "==============================================="
echo "Press Ctrl+C to stop both services."

# Wait for both background processes
wait 