# Canary Wallet

> Early warning system for Bitcoin cold storage

A canary in the cold mine. When your bitcoins are in cold storage, you seldom check on them.

Canary Wallet acts as an early warning system that alerts you the moment your coins move, giving you immediate notification of any activity on your wallets.

Built with Rust and BDK, it provides real-time transaction intelligence with advanced pattern recognition (RBF fee bumping, CPFP acceleration) and instant multilingual notifications via ntfy.sh.

Set custom balance alerts (equal, less than, or more than) to monitor your holdings. Perfect for monitoring cold storage and Bitcoin holdings you don't actively use.

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **electrs** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `1.7.0`
- **Website**: https://github.com/schjonhaug/canary
- **Source Repository**: https://github.com/schjonhaug/canary
- **Support**: https://github.com/schjonhaug/canary/issues
