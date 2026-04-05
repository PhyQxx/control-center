FROM node:22-slim
WORKDIR /app
# Use docker/package.json (no "type": "module") — avoids ESM/CJS conflict
COPY docker/package.json .
RUN npm install --production
COPY dist ./dist
COPY server.cjs .
RUN cp server.cjs server.js
# Fix: Docker 容器内 localhost 不指向宿主机，用 host.docker.internal 代替
RUN sed -i 's|http://localhost:18789|http://host.docker.internal:18789|g' /app/server.js /app/server.cjs
EXPOSE 3000
# Build: docker build -f docker/Dockerfile . -t control-center-v1.3:latest
# Run:   docker run -d --name control-center --add-host=host.docker.internal:host-gateway -p 8095:3000 -v /root/.openclaw:/root/.openclaw control-center-v1.3:latest
CMD ["node", "server.js"]
