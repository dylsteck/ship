# Custom E2B template with sandbox-agent + desktop environment
# Extends E2B desktop base image (includes Xfce, x11vnc, noVNC)
FROM e2bdev/desktop:latest

# Base image sets USER user but that user may not exist at build time; run as root
USER root

# Install common dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (needed by sandbox-agent ACP agent processes)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install sandbox-agent binary
RUN curl -fsSL https://releases.rivet.dev/sandbox-agent/0.3.x/install.sh | sh

# Copy desktop startup script (e2bdev/desktop base may not include it after E2B provisioning)
COPY e2b/start_command.sh /start_command.sh
RUN chmod +x /start_command.sh
