#!/usr/bin/env bash
# One-time setup for automatic deploys from GitHub Actions. Run as kegora on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/setup-ci-deploy.sh -o /tmp/setup-ci.sh
#   bash /tmp/setup-ci.sh
#
# It installs deployment/ci-release.sh as /usr/local/sbin/klassny-ci-release, lets kegora
# run exactly that file through sudo without a password, and creates an SSH key that can do
# nothing but run it. At the end it prints two values for the repository's Actions secrets.
# Running it again updates the installed script and keeps the existing key.
set -euo pipefail

repo="KEgoRAval/klassny-remont"
host="89.117.149.68"
target="/usr/local/sbin/klassny-ci-release"
sudoers="/etc/sudoers.d/klassny-ci-release"
key="$HOME/.ssh/klassny_ci_deploy"
forced="sudo -n $target"

if [[ "$(id -un)" != "kegora" ]]; then
  echo "Run this as kegora, not $(id -un)." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "https://raw.githubusercontent.com/$repo/main/deployment/ci-release.sh" -o "$tmp/ci-release.sh"
bash -n "$tmp/ci-release.sh"
sudo install -m 0755 -o root -g root "$tmp/ci-release.sh" "$target"
echo "Installed $target"

printf 'kegora ALL=(root) NOPASSWD: %s\n' "$target" > "$tmp/sudoers"
sudo visudo -cf "$tmp/sudoers" >/dev/null
sudo install -m 0440 -o root -g root "$tmp/sudoers" "$sudoers"
echo "Allowed kegora to run $target without a password"

install -d -m 0700 "$HOME/.ssh"
if [[ ! -f "$key" ]]; then
  ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy@klassny-remont" -f "$key"
  echo "Created deploy key $key"
fi
touch "$HOME/.ssh/authorized_keys"
chmod 0600 "$HOME/.ssh/authorized_keys"
pub="$(cat "$key.pub")"
# The key can only start a release: no shell, no forwarding, whatever command the client sends.
line="restrict,command=\"$forced\" $pub"
grep -vF "$pub" "$HOME/.ssh/authorized_keys" > "$tmp/authorized_keys" || true
printf '%s\n' "$line" >> "$tmp/authorized_keys"
install -m 0600 "$tmp/authorized_keys" "$HOME/.ssh/authorized_keys"
echo "Deploy key may only run: $forced"

cat <<EOF

================ Add these in GitHub ================
Repository → Settings → Secrets and variables → Actions → New repository secret

Name: DEPLOY_SSH_KEY
Value (everything between the lines, including BEGIN/END):
----------------------------------------------------
$(cat "$key")
----------------------------------------------------

Name: DEPLOY_KNOWN_HOSTS
Value:
----------------------------------------------------
$(ssh-keyscan -t ed25519 "$host" 2>/dev/null)
----------------------------------------------------

After both secrets are saved you can delete the private key from the server:
  rm $key
(the public key stays in authorized_keys; run this script again to make a new pair).
=====================================================
EOF
