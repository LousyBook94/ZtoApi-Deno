# Build stage: cache dependencies
FROM denoland/deno:latest AS build

# Set the working directory
WORKDIR /build

# Copy dependency files if they exist
# This helps cache dependencies separately from source code
COPY deps.ts* ./
COPY import_map.json* ./

# Cache dependencies if deps.ts exists
# This step will be skipped if deps.ts doesn't exist
RUN if [ -f deps.ts ]; then deno cache deps.ts; fi

# Copy all application files
COPY . .

# Final stage: minimal runtime
FROM denoland/deno:latest

# Set the working directory inside the container
WORKDIR /app

# Copy built/cached files from build stage
COPY --from=build /build .

# Expose the port the app runs on
EXPOSE 9090

# Define the command to run the application
# Using CMD in this format allows for graceful shutdown
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]