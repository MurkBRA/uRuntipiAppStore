# Stratum V2 UI

> Setup and monitor Stratum V2 mining

Stratum V2 UI is a setup wizard and monitoring dashboard for running a Stratum V2 mining stack on Runtipi. It guides you through pool mining, solo mining, and Job Declaration flows where your Bitcoin node can provide custom block templates.

The app starts and manages the required Translator Proxy and optional Job Declaration Client containers, helping SV1 miners connect to Stratum V2 infrastructure. After setup, the dashboard lets you monitor pool connection status, total hashrate, active workers, submitted shares, and hashrate history from one place.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.7.0`
- **Website**: https://stratumprotocol.org/
- **Source Repository**: https://github.com/stratum-mining/sv2-ui
- **Support**: https://github.com/stratum-mining/sv2-ui/issues
