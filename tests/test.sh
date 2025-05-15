#!/bin/bash
# Test script for Calendly Clone APIs

# Make sure script is executable
if [ ! -x "$0" ]; then
  echo "Making script executable..."
  chmod +x "$0"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js to run tests."
  exit 1
fi

# Check if services are running
echo "Checking if services are running..."

# Try to connect to REST API
if ! curl -s http://localhost:3002 > /dev/null; then
  echo "REST API is not running. Please start the services using ./run.sh before running tests."
  exit 1
fi

# Try to connect to SOAP API
if ! curl -s http://localhost:3001 > /dev/null; then
  echo "SOAP API is not running. Please start the services using ./run.sh before running tests."
  exit 1
fi

# Run the API comparison tests
echo "Running API comparison tests..."
node $(dirname "$0")/api-comparison.js

# Check if tests were successful
if [ $? -eq 0 ]; then
  echo "All tests passed successfully!"
  exit 0
else
  echo "Some tests failed. Please check the output above for details."
  exit 1
fi
