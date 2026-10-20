# lnSwitchboard

> Self-Hosted Lightning Addresses for Your Domain

Host your own Lightning Addresses directly from your node. lnSwitchboard exposes only the public LNURL-pay endpoint while keeping its dashboard and admin routes local on port 22121.

Create unlimited Lightning Addresses, usernames, tags, and vanity handles, all mapped to the same backend. Enjoy a simple UI, built-in rate limiting, real settlement tracking, inbound liquidity insights, and a clean activity log for every request.

Compatible with all major LNURL-supporting wallets and services. No command line, no custodians, no external dependencies — just your node serving your domain.

You will need your own domain and a reverse proxy to use this application. Click “Help” within the app to open the wiki and follow the getting-started guides.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.3.2-patch.1`
- **Website**: https://github.com/RyleaStark/lnSwitchboard
- **Source Repository**: https://github.com/RyleaStark/lnSwitchboard
- **Support**: https://github.com/RyleaStark/lnSwitchboard/issues
