# Nginx SSL-terminating reverse proxy for Geist services
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create directories
RUN mkdir -p /app/certificates /var/log/nginx

# Copy nginx configuration
COPY conf/nginx.conf /etc/nginx/nginx.conf

# Note: Certificates should be mounted as a volume at runtime

# Copy startup script
COPY start-nginx.sh /app/start-nginx.sh
RUN chmod +x /app/start-nginx.sh

# Expose ports (80 for HTTP, 443 for HTTPS)
EXPOSE 80 443

# Use our startup script
CMD ["/app/start-nginx.sh"]

# Example usage:

# HTTP mode (standalone containers):
# docker run -d \
#   --name nginx-server \
#   -p 80:80 \
#   -p 443:443 \
#   --add-host=host.docker.internal:host-gateway \
#   alo42/nginx-server:latest

# Alternative with host networking (recommended for port 443):
# docker run -d \
#   --name nginx-server \
#   --network host \
#   alo42/nginx-server:latest

# SSL/HTTPS mode with mounted certificates:
# docker run -d \
#   --name nginx-server \
#   -p 80:80 \
#   -p 443:443 \
#   --add-host=host.docker.internal:host-gateway \
#   -e SSL_ENABLED=true \
#   -e INFERENCE_CERT_PATH=/app/certificates/cert.pem \
#   -e INFERENCE_KEY_PATH=/app/certificates/key.pem \
#   -v /root/certificates:/app/certificates:ro \
#   alo42/nginx-server:latest

# Auto-generate self-signed certificates (recommended for testing):
# docker run -d \
#   --name nginx-server \
#   -p 80:80 \
#   -p 443:443 \
#   --add-host=host.docker.internal:host-gateway \
#   -e SSL_ENABLED=false \
#   alo42/nginx-server:latest
