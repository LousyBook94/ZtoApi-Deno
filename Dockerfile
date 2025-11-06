# Use the official Deno image
FROM denoland/deno:latest

# Set the working directory inside the container
WORKDIR /app

# Copy all application files
COPY . .

# Expose the port the app runs on
EXPOSE 9090

# Define the command to run the application
# Using CMD in this format allows for graceful shutdown
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]