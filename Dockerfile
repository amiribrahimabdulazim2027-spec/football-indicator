FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (skip chromium download - already in image)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
RUN npm ci --only=production 2>/dev/null || npm install --only=production

# Copy app files
COPY server.js ./
COPY public/ ./public/

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV NODE_ENV=production

# Start server
CMD ["node", "server.js"]
