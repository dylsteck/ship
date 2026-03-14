# Custom E2B template with sandbox-agent + desktop environment
# Extends E2B desktop base image (includes Xfce, x11vnc, noVNC)
FROM e2bdev/desktop:latest

# Install common dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install sandbox-agent binary
RUN curl -fsSL https://releases.rivet.dev/sandbox-agent/0.3.x/install.sh | sh

# Pre-install agent binaries (claude, opencode, codex)
RUN sandbox-agent install-agent claude \
    && sandbox-agent install-agent opencode \
    && sandbox-agent install-agent codex
