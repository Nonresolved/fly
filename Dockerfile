# fly.x landing — static site served by nginx-alpine.
# Small (~25 MB), no build step, no state.
#
# Build:
#   docker build -t code.silentmode.st/silentmode/fly:latest .
#
# Push (after `docker login code.silentmode.st`):
#   docker push code.silentmode.st/silentmode/fly:latest
#
# Deploy on Flux/Orbit: image = code.silentmode.st/silentmode/fly:latest, port 80.

FROM nginx:1.27-alpine

# Drop the default nginx welcome page.
RUN rm -rf /usr/share/nginx/html/*

# Ship the site.
COPY index.html /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/

# Tighten nginx defaults for a static-only workload:
# - long cache on the fonts + js
# - short cache on the HTML so we can ship a redeploy fast
# - gzip on for text/css/js
RUN printf '%s\n' \
  'server {' \
  '  listen 80 default_server;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  gzip on;' \
  '  gzip_types text/plain text/css text/html application/javascript application/json image/svg+xml;' \
  '  location = / { add_header Cache-Control "no-cache, must-revalidate"; try_files /index.html =404; }' \
  '  location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; }' \
  '  location /js/ { add_header Cache-Control "public, max-age=86400"; }' \
  '  location /favicon.svg { access_log off; try_files $uri =404; }' \
  '  location / { try_files $uri $uri/ =404; }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=2 \
  CMD wget -qO- --tries=1 http://localhost/ >/dev/null || exit 1
