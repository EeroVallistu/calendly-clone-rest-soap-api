#!/bin/bash
# Run script for Calendly Clone APIs

# Make sure script is executable
if [ ! -x "$0" ]; then
  echo "Making script executable..."
  chmod +x "$0"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js to run this application."
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed. Please install npm to run this application."
  exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start both REST and SOAP services
echo "Starting REST and SOAP APIs..."
npm start
