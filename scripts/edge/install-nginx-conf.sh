#!/bin/sh
# Install MRMS's server block into the nginx that owns 80/443 on this server
# (eaglestays' container), test it, and reload -- or undo it.
#
# Run by .github/workflows/deploy.yml from the deploy directory, after the stack
# is healthy:
#   DOCKER="sudo -n /usr/bin/docker" ./scripts/edge/install-nginx-conf.sh
#
# The nginx container belongs to another project. Two rules follow from that:
#   - Nothing is left on disk that nginx has not just accepted. If `nginx -t`
#     fails, the previous file is restored (or ours removed) before exiting, so
#     eaglestays' next restart cannot trip over a broken MRMS block.
#   - If that nginx has not been set up to include shared server blocks yet
#     (the one-time eaglestays change), this is a warning, not a failed MRMS
#     deploy: MRMS still works on APP_PORT, it just is not on the domain yet.
set -eu

DOCKER="${DOCKER:-docker}"
EDGE_DIR="${EDGE_DIR:-/var/www/edge}"
SRC="$(pwd)/deploy/edge/care.conf"
NAME=mrms-care.conf
# Already pulled for the certbot service, so no extra image on the box.
HELPER_IMAGE="${EDGE_HELPER_IMAGE:-certbot/certbot:v5.8.0}"

[ -f "$SRC" ] || { echo "install-nginx-conf: $SRC is missing" >&2; exit 1; }

# Whatever publishes 443 is the front door; finding it by that rather than by
# name keeps this working if eaglestays renames its project or service.
nginx="$($DOCKER ps -q --filter publish=443 | head -n 1)"
if [ -z "$nginx" ]; then
  echo "::warning::No container publishes port 443 on this server. Skipping the domain setup; MRMS is reachable on APP_PORT only."
  exit 0
fi
if ! $DOCKER exec "$nginx" test -d /etc/nginx/shared.d; then
  echo "::warning::The nginx on 443 does not mount /etc/nginx/shared.d yet (the one-time eaglestays change is not deployed). Skipping; MRMS is reachable on APP_PORT only."
  exit 0
fi

# /var/www/edge may be root-owned (Docker creates missing bind-mount sources as
# root), and the deploy user may only run docker through sudo. So the file is
# written from a throwaway container rather than with cp on the host.
in_edge() {
  $DOCKER run --rm --entrypoint sh \
    -v "$EDGE_DIR:/edge" -v "$SRC:/src/care.conf:ro" \
    "$HELPER_IMAGE" -c "$1"
}

in_edge "set -e
  mkdir -p /edge/nginx /edge/certs /edge/acme
  chmod 0755 /edge /edge/nginx /edge/certs /edge/acme
  if [ -f /edge/nginx/$NAME ]; then cp -p /edge/nginx/$NAME /edge/nginx/$NAME.bak; else rm -f /edge/nginx/$NAME.bak; fi
  cp /src/care.conf /edge/nginx/$NAME
  chmod 0644 /edge/nginx/$NAME"

if out="$($DOCKER exec "$nginx" nginx -t 2>&1)"; then
  $DOCKER exec "$nginx" nginx -s reload
  in_edge "rm -f /edge/nginx/$NAME.bak"
  echo "install-nginx-conf: $NAME installed and nginx reloaded"
else
  echo "$out" >&2
  in_edge "if [ -f /edge/nginx/$NAME.bak ]; then mv -f /edge/nginx/$NAME.bak /edge/nginx/$NAME; else rm -f /edge/nginx/$NAME; fi"
  echo "::error::nginx rejected $NAME; the previous version was restored and nginx was not reloaded." >&2
  exit 1
fi
