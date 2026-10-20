# BFFless

> Self-hosted static site hosting platform

BFFless is a self-hosted platform for hosting static websites and build artifacts from CI/CD pipelines.

Key Features:
  - Upload static sites via CLI, API, or GitHub Actions
  - Instant deployments with unique URLs per commit
  - Deployment aliases for staging, production, and custom environments
  - Custom domain support with subdomain routing
  - Built-in admin dashboard for managing deployments
  - Privacy-focused: All data stays on your Umbrel


Perfect for developers who want full control over their static site hosting without relying on external services.

Note: This app requires a Cloudflare Tunnel for external domain access. Internal access shows setup instructions.

## Inter-App Connections

This package integrates with **cloudflared** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.4.15`
- **Website**: https://docs.bffless.app/deployment/umbrel/
- **Source Repository**: https://github.com/bffless/ce
- **Support**: https://github.com/bffless/ce/issues
