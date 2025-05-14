#!/bin/bash

# Exit on any error
set -e

# Define script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if REST API is running
function check_rest_api() {
  echo "Checking if REST API is running..."
  if ! curl -s http://localhost:3002/docs > /dev/null; then
    echo "REST API is not running. Please start it on port 3002."
    exit 1
  fi
  echo "REST API is running."
}

# Check if SOAP API is running
function check_soap_api() {
  echo "Checking if SOAP API is running..."
  if ! curl -s http://localhost:3001/wsdl/calendly-soap-service.wsdl > /dev/null; then
    echo "SOAP API is not running. Starting it..."
    bash "$PROJECT_ROOT/scripts/run.sh" &
    # Wait for SOAP API to start
    sleep 5
  fi
  echo "SOAP API is running."
}

# Install test dependencies
function install_dependencies() {
  echo "Installing test dependencies..."
  cd "$PROJECT_ROOT/tests"
  if [ ! -d "node_modules" ]; then
    npm install
  fi
}

# Run the comparison tests
function run_tests() {
  echo "Running API comparison tests..."
  cd "$PROJECT_ROOT/tests"
  node api-comparison.js
}

# Main execution
echo "=== Starting API Comparison Tests ==="
check_rest_api
check_soap_api
install_dependencies
run_tests
echo "=== Tests Completed ===" 