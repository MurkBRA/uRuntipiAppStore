# Urbit Bitcoin Connector

> Connect your Urbit's Bitcoin wallet to your Bitcoin node

Urbit has a native Bitcoin wallet that you can connect to a full node via an intermediary, called a provider. Providers run a piece of backend software called %btc-provider that communicates with a full node with bitcoind and electrs, as well as a custome Node Express proxy to translate RPC calls between TCP and HTTP. This app will install the Express proxy and configure it to point at your Umbrel's Bitcoin full node. Using this, you can configure a Bitcoin provider on a ship (even one running on your Umbrel) and configure it, or other ships to point their wallets at it.

This app also provides an information GUI web page, with instructions on connecting your provider ship and Bitcoin wallet. The web UI is accessible at port 9090. Note that if your Urbit is running on your Umbrel, you must configure your provider to point at the Umbrel's local/private IP address (like http://192.168.0.10:55555).

Credit to ~timluc-miptev & ~master-forwex

## Inter-App Connections

This package integrates with **bitcoin, electrs** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.1.0`
- **Website**: https://subject.network
- **Source Repository**: https://github.com/yapishu/urbit-bitcoin-node
- **Support**: https://github.com/yapishu/urbit-bitcoin-node
