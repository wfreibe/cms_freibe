#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_PATH:?Missing DEPLOY_PATH}"
: "${DEPLOY_PHP:?Missing DEPLOY_PHP}"
: "${DEPLOY_KEY:?Missing DEPLOY_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Missing DEPLOY_KNOWN_HOSTS}"
: "${RELEASE_ID:?Missing RELEASE_ID}"
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || exit 2
[[ "$DEPLOY_USER" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]+$ ]] || exit 2
[[ "$DEPLOY_PATH" =~ ^/kunden/[0-9]+_[0-9]+/webseiten/[a-zA-Z0-9_-]+$ ]] || exit 2
[[ "$DEPLOY_PHP" =~ ^/[a-zA-Z0-9_./-]+$ ]] || exit 2
[[ "$RELEASE_ID" =~ ^[a-zA-Z0-9-]+$ ]] || exit 2
[[ "${DEPLOY_URL:-}" == "https://freiberger.design" ]] || exit 2
test -s dist-packages/cms_sfreibe-deploy.zip
# Files live only in the ephemeral runner; keys are never uploaded as artifacts.
keydir=$(mktemp -d)
printf '%s\n' "$DEPLOY_KEY" > "$keydir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$keydir/known_hosts"
chmod 600 "$keydir/key" "$keydir/known_hosts"
unset DEPLOY_KEY DEPLOY_KNOWN_HOSTS
ssh_options=(-i "$keydir/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$keydir/known_hosts" -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -m hmac-sha2-256-etm@openssh.com)
target="$DEPLOY_USER@$DEPLOY_HOST"
# Validate remote PHP and existing live data before uploading any application files.
ssh "${ssh_options[@]}" "$target" "test -d '$DEPLOY_PATH/webroot' && test -f '$DEPLOY_PATH/server/data/content.sqlite' && '$DEPLOY_PHP' -r 'exit(PHP_VERSION_ID >= 80200 && extension_loaded(\"pdo_sqlite\") && extension_loaded(\"mbstring\") && extension_loaded(\"gd\") && extension_loaded(\"zip\") ? 0 : 1);' && umask 077 && mkdir -p '$DEPLOY_PATH/.deploy/packages'"
archive="dist-packages/cms_sfreibe-deploy.zip"
digest=$(sha256sum "$archive" | cut -d' ' -f1)
scp "${ssh_options[@]}" "$archive" "$target:$DEPLOY_PATH/.deploy/packages/$RELEASE_ID.zip"
ssh "${ssh_options[@]}" "$target" "bash -s -- '$DEPLOY_PATH' '$DEPLOY_PHP' '$RELEASE_ID' '$digest'" < scripts/deploy_remote.sh
# Check the public API and verify the deployed asset reference matches this artifact.
curl --fail --silent --show-error --max-time 30 "$DEPLOY_URL/api/ready" | grep -Eq '"ready"[[:space:]]*:[[:space:]]*true'
asset=$(unzip -p "$archive" webroot/index.html | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
test -n "$asset"
curl --fail --silent --show-error --max-time 30 -H 'Cache-Control: no-cache' "$DEPLOY_URL/?release=$RELEASE_ID" | grep -Fq "$asset"
printf 'Production deployment verified: %s\n' "$RELEASE_ID"
