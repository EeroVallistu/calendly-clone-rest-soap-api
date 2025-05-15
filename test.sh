#!/bin/bash
# Test script for Calendly Clone APIs (root directory wrapper)

# Make sure script is executable
if [ ! -x "$0" ]; then
  echo "Making script executable..."
  chmod +x "$0"
fi

# Make sure tests/test.sh is executable
if [ ! -x "tests/test.sh" ]; then
  echo "Making tests/test.sh executable..."
  chmod +x tests/test.sh
fi

# Run the test script in the tests directory
echo "Running tests..."
./tests/test.sh

# Pass along the exit code
exit $?
