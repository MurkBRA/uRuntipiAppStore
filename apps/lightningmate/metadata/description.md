# Lightning Mate

> Profit-aware management & autopilot for your Lightning node

Lightning Mate manages your Lightning node so you don't have to babysit it. It connects automatically to your Runtipi Lightning (LND) node and asks three short questions the first time you open it: what the node is for, how much the app may use, and what that will do.

The start page says what needs you today. Click any node for its details: how its channel is doing, what it earned, what each side charges and its place in the network, or how it scores as a peer if you are thinking of opening a channel. Every setting is still there for those who want it, under Advanced.

See what each channel earned, a routing report, and a Profit & Loss overview (routing revenue against every cost). Get scored channel-peer suggestions from the network graph and open channels in a click, plus a node health score.

Flip on the Autopilot and the node tunes its own pricing, runs only profitable rebalances, and opens channels to top peers, on recommended settings with safe caps and cooldowns.

Buy and sell channel liquidity on the Amboss Magma marketplace right inside the app: purchase inbound, list your own offer, and let the Autopilot fulfil orders, opening channels to buyers within your capital, channel-size and on-chain reserve caps. Amboss decides which seller gets an order.

LSP mode (experimental) turns your node into a Lightning Service Provider: wallets speaking the open LSPS1 standard (bLIP-51) can buy inbound channels from you directly, priced automatically, paid via a hold invoice that only settles once the channel is opening, refunded automatically on any failure. Off by default.

Lightning Mate signs in with the per-app password Runtipi generates for it (shown when you open the app), so no other app on your server can read your node or move your funds.

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.9.1`
- **Website**: https://opensourceminers.de
- **Source Repository**: https://github.com/opensourceminers/lightningmate
- **Support**: https://github.com/opensourceminers/lightningmate/issues
