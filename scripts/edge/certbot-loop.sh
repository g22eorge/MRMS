#!/bin/sh
# Issue and renew the Let's Encrypt certificate(s) for the hostnames MRMS serves
# through the shared nginx on the VPS, and publish them where nginx reads them.
#
# Runs as the `certbot` service (docker-compose.yml, profile `edge`). It needs
# no attention at the DNS switch: until DNS for a hostname points at this server
# it only checks locally and waits, and the first check after the switch
# succeeds, issues, and publishes. nginx reads the certificate at handshake time
# (deploy/edge/care.conf), so no reload is needed either.
#
# Why it probes before calling certbot: Let's Encrypt allows 5 failed
# validations per hostname per hour. Calling certbot every few minutes while DNS
# still points at Vercel would burn that within the hour, and the real issuance
# right after the switch would then be refused for up to an hour -- an hour of
# care with no valid certificate. The probe costs Let's Encrypt nothing: it
# writes a random token into the challenge webroot and fetches it back through
# the public hostname. Getting our own token back proves DNS and nginx both
# route here, which is exactly what HTTP-01 is about to check.
set -eu

DOMAINS="$(printf '%s' "${EDGE_DOMAINS:-care.eagleinfosolutions.com}" | tr ',' ' ')"
WEBROOT=/edge/acme
PUBLISH=/edge/certs
# nginx:alpine runs its workers as uid/gid 101. The key is read at handshake
# time by a worker, not by the root master process, so it must be readable by
# that group -- the default root-only key fails every handshake with
# "permission denied" in nginx's error log and nothing anywhere else.
NGINX_GID="${EDGE_NGINX_GID:-101}"
PROBE_INTERVAL="${EDGE_PROBE_INTERVAL:-60}"
RENEW_INTERVAL="${EDGE_RENEW_INTERVAL:-43200}"

if [ -n "${CERTBOT_EMAIL:-}" ]; then
  EMAIL_ARGS="--email $CERTBOT_EMAIL --no-eff-email"
else
  EMAIL_ARGS="--register-unsafely-without-email"
fi

log() { echo "[certbot-loop] $*"; }

mkdir -p "$WEBROOT/.well-known/acme-challenge" "$PUBLISH"
chmod 0755 "$WEBROOT" "$WEBROOT/.well-known" "$WEBROOT/.well-known/acme-challenge" "$PUBLISH"

# The hostname is resolved through a public resolver, not the server's own.
# The hosting provider's resolver (first in the host's resolv.conf) cached the
# old Vercel record for its full one-hour TTL at the care switch, so a probe
# that trusted it kept reporting "not routed here" for an hour while the rest of
# the internet -- Let's Encrypt included -- already pointed at this server.
PROBE_RESOLVER="${EDGE_PROBE_RESOLVER:-1.1.1.1}"

public_ipv4s() {
  # busybox nslookup prints the server first ("Address: 1.1.1.1:53"); skip it.
  nslookup "$1" "$PROBE_RESOLVER" 2>/dev/null \
    | awk '/^Address/ { print $NF }' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
    | grep -vxF "$PROBE_RESOLVER" || true
}

routes_here() {
  domain="$1"
  name="mrms-probe-$domain"
  token="$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf '%s' "$token" > "$WEBROOT/.well-known/acme-challenge/$name"
  chmod 0644 "$WEBROOT/.well-known/acme-challenge/$name"
  ok=1
  for ip in $(public_ipv4s "$domain"); do
    # Ask that address directly, with the hostname in Host, the way HTTP-01 does.
    got="$(wget -q -T 10 --header "Host: $domain" -O - \
      "http://$ip/.well-known/acme-challenge/$name" 2>/dev/null || true)"
    if [ "$got" = "$token" ]; then ok=0; break; fi
  done
  rm -f "$WEBROOT/.well-known/acme-challenge/$name"
  return "$ok"
}

publish() {
  domain="$1"
  live="/etc/letsencrypt/live/$domain"
  [ -f "$live/fullchain.pem" ] || return 1
  out="$PUBLISH/$domain"
  mkdir -p "$out"
  chmod 0755 "$out"
  # Copy then rename, so nginx never reads a half-written file mid-handshake.
  cp -L "$live/fullchain.pem" "$out/.fullchain.pem.tmp"
  cp -L "$live/privkey.pem" "$out/.privkey.pem.tmp"
  chmod 0644 "$out/.fullchain.pem.tmp"
  chown "0:$NGINX_GID" "$out/.privkey.pem.tmp"
  chmod 0640 "$out/.privkey.pem.tmp"
  mv -f "$out/.fullchain.pem.tmp" "$out/fullchain.pem"
  mv -f "$out/.privkey.pem.tmp" "$out/privkey.pem"
}

while :; do
  next="$RENEW_INTERVAL"
  for domain in $DOMAINS; do
    if routes_here "$domain"; then
      # --keep-until-expiring makes this a local no-op until renewal is due
      # (30 days before expiry), so running it twice a day costs nothing.
      # shellcheck disable=SC2086
      if certbot certonly --webroot -w "$WEBROOT" -d "$domain" --cert-name "$domain" \
          --non-interactive --agree-tos --keep-until-expiring $EMAIL_ARGS; then
        publish "$domain" && log "$domain: certificate current and published"
      else
        # A failure after a good probe is rare (CAA, LE outage). Back off an
        # hour so repeated failures cannot reach the 5/hour validation limit.
        log "$domain: certbot failed after a successful probe; retrying in 1h"
        publish "$domain" || true
        [ "$next" -gt 3600 ] && next=3600
      fi
    else
      # Keep serving whatever we already have (e.g. DNS briefly elsewhere).
      if publish "$domain"; then
        log "$domain: not routed here right now; keeping existing certificate"
      else
        log "$domain: DNS does not point here yet; checking again in ${PROBE_INTERVAL}s"
        next="$PROBE_INTERVAL"
      fi
    fi
  done
  sleep "$next"
done
