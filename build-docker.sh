#!/bin/bash

# Set maximum number of attempts
MAX_ATTEMPTS=3

# Function to build Docker image
build_docker() {
  echo "Attempt $1 of $MAX_ATTEMPTS to build Docker image..."
  
  # Calculate timeout based on attempt number (increasing with each attempt)
  TIMEOUT=$((600000 + ($1 * 300000)))
  
  # Update the YARN_NETWORK_TIMEOUT in docker-compose.yml
  sed -i "s/YARN_NETWORK_TIMEOUT=[0-9]*/YARN_NETWORK_TIMEOUT=$TIMEOUT/" docker-compose.yml
  
  echo "Building with YARN_NETWORK_TIMEOUT=$TIMEOUT"
  
  # Build the Docker image
  sudo docker-compose build --no-cache
  
  # Check if build was successful
  if [ $? -eq 0 ]; then
    echo "Docker build successful!"
    return 0
  else
    echo "Docker build failed on attempt $1"
    return 1
  fi
}

# Main script
echo "Starting Docker build process with multiple attempts..."

for ((i=1; i<=$MAX_ATTEMPTS; i++)); do
  build_docker $i
  
  if [ $? -eq 0 ]; then
    echo "Build completed successfully on attempt $i"
    exit 0
  fi
  
  if [ $i -lt $MAX_ATTEMPTS ]; then
    echo "Waiting 30 seconds before next attempt..."
    sleep 30
  fi
done

echo "All build attempts failed. Please check your network connection and try again."
exit 1 