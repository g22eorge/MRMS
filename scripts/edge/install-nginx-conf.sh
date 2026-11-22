#!/bin/sh
# Install MRMS's server blocks (every deploy/edge/*.conf) into the nginx that
# owns 80/443 on this server (eaglestays' container), test them, and reload --
# or undo them.
#
# Run by .github/workflows/deploy.yml from the deploy directory, after the stack
# is healthy:
#   DOCKER="sudo -n /usr/bin/docker" ./scripts/edge/install-nginx-conf.sh
#
# deploy/edge/<name>.conf is installed as /var/www/edge/nginx/mrms-<name>.conf.
#
# The nginx container belongs to another project. Two rules follow from that:
#   - Nothing is left on disk that nginx has not just accepted. The blocks go in
#     as one unit: if `nginx -t` fails, every file is put back the way it was
#     (previous version restored, new ones removed) before exiting, so
#     eaglestays' next restart cannot trip over a broken MRMS block.
#   - If that nginx has not been set up to include shared server blocks yet
#     (the one-time eaglestays change), this is a warning, not a failed MRMS
#     deploy: MRMS still works on APP_PORT, it just is not on the domain yet.
set -eu

DOCKER="${DOCKER:-docker}"
EDGE_DIR="${EDGE_DIR:-/var/www/edge}"
SRC_DIR="$(pwd)/deploy/edge"
# Already pulled for the certbot service, so no extra image on the box.
HELPER_IMAGE="${EDGE_HELPER_IMAGE:-certbot/certbot:v5.8.0}"

ls "$SRC_DIR"/*.conf >/dev/null 2>&1 || { echo "install-nginx-conf: no $SRC_DIR/*.conf" >&2; exit 1; }

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
# root), and the deploy user may only run docker through sudo. So files are
# written from a throwaway container rather than with cp on the host.
in_edge() {
  $DOCKER run --rm --entrypoint sh \
    -v "$EDGE_DIR:/edge" -v "$SRC_DIR:/src:ro" \
    "$HELPER_IMAGE" -c "$1"
}

# For each source file: keep the installed version as .bak (or mark it .new
# when there was none), then copy the new one in.
in_edge 'set -e
  mkdir -p /edge/nginx /edge/certs /edge/acme
  chmod 0755 /edge /edge/nginx /edge/certs /edge/acme
  for f in /src/*.conf; do
    dst="/edge/nginx/mrms-$(basename "$f")"
    rm -f "$dst.bak" "$dst.new"
    if [ -f "$dst" ]; then cp -p "$dst" "$dst.bak"; else : > "$dst.new"; fi
    cp "$f" "$dst"
    chmod 0644 "$dst"
  done'

if out="$($DOCKER exec "$nginx" nginx -t 2>&1)"; then
  $DOCKER exec "$nginx" nginx -s reload
  in_edge 'rm -f /edge/nginx/mrms-*.conf.bak /edge/nginx/mrms-*.conf.new'
  echo "install-nginx-conf: $(cd "$SRC_DIR" && ls *.conf | sed 's/^/mrms-/' | tr '\n' ' ')installed and nginx reloaded"
else
  echo "$out" >&2
  in_edge 'for f in /src/*.conf; do
    dst="/edge/nginx/mrms-$(basename "$f")"
    if [ -f "$dst.bak" ]; then mv -f "$dst.bak" "$dst"
    elif [ -f "$dst.new" ]; then rm -f "$dst" "$dst.new"; fi
  done'
  echo "::error::nginx rejected the MRMS server blocks; the previous versions were restored and nginx was not reloaded." >&2
  exit 1
fi
