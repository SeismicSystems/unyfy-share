# syntax=docker/dockerfile:1


ARG NODE_VERSION=21.3.0
ARG PNPM_VERSION=8.12.0

FROM node:${NODE_VERSION}
RUN apt-get update


# Install pnpm and typescript
RUN npm install -g pnpm@${PNPM_VERSION}
RUN npm install -g typescript
RUN npm install -g ts-node
RUN apt-get install -y build-essential cmake libgmp-dev libsodium-dev nasm curl m4 jq

WORKDIR /usr/src/app
RUN curl -L https://foundry.paradigm.xyz | bash


# Copy the rest of the source files into the image.
COPY . .
RUN sh docker_setup.sh


# Expose the port that the application listens on.
EXPOSE 80

# Run the application.
CMD ["pnpm", "-C", "client-sample", "run", "dev:listen"]
