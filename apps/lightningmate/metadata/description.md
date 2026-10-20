# Lightning Mate

> Profit-aware management & autopilot for your Lightning node

Lightning Mate manages your Lightning node so you don't have to babysit it. It connects automatically to your Umbrel Lightning (LND) node.

See channels with live balance bars and source / sink / router roles, a full Forwards routing report, and a Profit & Loss overview (routing revenue vs channel-open and rebalancing costs). Get scored channel-peer suggestions from the network graph and open channels in a click, plus a node health score.

Flip on the Autopilot and the node tunes its own pricing, runs only profitable rebalances, and opens channels to top peers — all on recommended settings with safe caps and cooldowns.

Buy and sell channel liquidity on the Amboss Magma marketplace right inside the app: purchase inbound, list your own offer, and let the Autopilot fulfil orders — opening channels to buyers within your capital, channel-size and on-chain reserve caps.

LSP mode (beta) turns your node into a Lightning Service Provider: wallets speaking the open LSPS1 standard (bLIP-51) can buy inbound channels from you directly — priced automatically, paid via a hold invoice that only settles once the channel is opening, refunded automatically on any failure. Off by default.

Lightning Mate signs in with the per-app password Umbrel generates for it (shown when you open the app), so no other app on your server can read your node or move your funds.

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.7.7`
- **Website**: https://opensourceminers.de
- **Source Repository**: https://github.com/opensourceminers/lightningmate
- **Support**: https://github.com/opensourceminers/lightningmate/issues
