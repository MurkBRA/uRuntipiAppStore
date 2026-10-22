# Hashrate Autopilot

> Autopilot for renting hashrate to mine on Ocean Mining

PROJECT STATUS (August 2026): this app is in maintenance mode in its current SHA-256 form. It keeps working, and fixes may still ship, but the developer has personally stepped back from SHA-256 mining and no new SHA-256 features are planned - read this before building your setup around future feature work. Full reasoning: https://github.com/rdouma/hashrate-autopilot/discussions/377

ALREADY RUNNING THE COMMUNITY-STORE VERSION? This official-store app has a different app id than the community-store one (rdouma-hashrate-autopilot), so it installs as a separate app with an empty database. A one-time five-minute migration brings your full history across: https://github.com/rdouma/hashrate-autopilot/blob/main/docs/migrating-from-community-store.md

Rent hashrate on the Braiins Hashpower marketplace and route it to your own Ocean non-custodial mining pool, automatically. Each tick the autopilot finds the cheapest available price for your target hashrate, adds a small operator-chosen cushion, and bids exactly that price. You set a maximum you are willing to pay, and the controller never goes above it.

Why this matters: Ocean is a non-custodial pool. Each Ocean block's coinbase pays out to every miner whose accumulated earnings have crossed the on-chain payout threshold (1,048,576 sat) - the coinbase IS the payout, in a single transaction the chain itself executes when the block confirms. Most pools (FPPS, PPS+, PPLNS) instead pay their own wallet first and then send miners a second transaction on the pool's settlement cadence; that intermediate pool wallet is bitcoin the pool custodies on your behalf, and it's what gets lost when a pool goes dark. With Ocean your maximum exposure to pool failure is your current unpaid balance (bounded by the threshold), and every past payout is publicly verifiable on-chain forever. Ocean's Datum templates also filter non-financial spam transactions. Renting hashrate to that kind of pool is a small contribution to keeping Bitcoin mining decentralized.

Solo mining via Ocean's solo template should also work, though so far the autopilot has only been tested against the regular Ocean+Datum pool setup.

Setup is a three-step web wizard. After setup you get a dashboard with live decisions, charts, the DRY-RUN / LIVE / PAUSED switch, and a P&L panel that reads spend from Braiins and earnings from your on-chain wallet.

This app declares a Bitcoin node, an Electrum server, and Datum Gateway as dependencies, so Runtipi will prompt you to install them during setup - any of Runtipi's Bitcoin node apps and any Electrum server (Electrs, Fulcrum, or ElectrumX) works. Once all apps run on the same Runtipi, the autopilot's dashboard auto-discovers the local Datum HTTP API, Electrum server, and Bitcoin RPC across Runtipi's shared Docker network - zero copy/paste, the worker-count, hashrate, P&L earnings, and BIP110 signalling panels all populate on first boot. (Pointing at off-Runtipi instances is also supported - just override the URLs in Config after setup.)

## Inter-App Connections

This package integrates with **bitcoin, electrs, datum** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `1.18.2-patch.1`
- **Website**: https://github.com/rdouma/hashrate-autopilot
- **Source Repository**: https://github.com/rdouma/hashrate-autopilot
- **Support**: https://github.com/rdouma/hashrate-autopilot/issues
