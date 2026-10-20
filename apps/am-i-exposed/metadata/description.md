# am-i.exposed

> Bitcoin privacy scanner - see what the blockchain reveals about you

Paste a Bitcoin address, transaction ID, xpub or descriptor, or an unsigned PSBT and get a privacy score from 0 to 100 with clear findings and fixes. The engine runs 34 heuristics and 10 chain analysis modules covering address reuse, change detection, CoinJoin detection (Whirlpool, WabiSabi, JoinMarket), script types, timing, wallet fingerprinting and entity proximity, plus Boltzmann entropy computed on-device and an interactive transaction graph explorer.

All analysis runs client-side in the browser. Blockchain data comes from the local Umbrel mempool instance, so addresses and transactions never leave the network. The optional Chainalysis check is routed over Tor. No tracking, no logging, no third-party analytics.

## Inter-App Connections

This package integrates with **mempool** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.43.1`
- **Website**: https://am-i.exposed
- **Source Repository**: https://github.com/Copexit/am-i-exposed
- **Support**: https://github.com/Copexit/am-i-exposed/issues
