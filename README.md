# fly.x

Static landing page for `fly.x` — a decentralized flight-search entry point on
Bitcoin Cash. This repo holds the landing HTML + the Dockerfile that packages
it for Flux (or any container host).

## Development

Just open `index.html` in a browser. Nothing to build.

## Build the container

```bash
docker build -t code.silentmode.st/silentmode/fly:latest .
```

Verify locally:

```bash
docker run --rm -p 8080:80 code.silentmode.st/silentmode/fly:latest
# → open http://localhost:8080
```

## Publish to Hephaestus registry

Hephaestus (Forgejo 10) exposes an OCI registry at `code.silentmode.st`. First
time you push, log in with a personal access token that has the `write:package`
scope — see Settings → Applications on your Hephaestus account.

```bash
docker login code.silentmode.st -u <your-username>
docker push code.silentmode.st/silentmode/fly:latest
```

## Deploy on Flux (Orbit)

1. Go to <https://orbit.runonflux.com/dashboard/deploy>.
2. Image reference: `code.silentmode.st/silentmode/fly:latest`.
3. Port: `80` (HTTP).
4. Resources: minimum — the container is stateless and idle-cheap.
5. Deploy. Flux gives you a URL back plus the assigned IP.

## Wire fly.x to the deployment

Once Flux hands you an IP, update the fly.x records on Sirius:

- `ip`  → the Flux-assigned IP
- `s3`  → Sia bucket key for the static-mirror backup (optional)
- `tls` → Silent Mode CA fingerprint (already set on mint)

Verify:

```bash
curl -s https://silentmode.st/api/dns/fly.x | jq
curl -sk https://fly.x/ | head -5      # via Theseus/Ariadne
curl -sk https://navigate.st/bns/fly.x | head -5   # via gateway
```
