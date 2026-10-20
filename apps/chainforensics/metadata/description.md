# ChainForensics

> Privacy-focused Bitcoin blockchain analysis & UTXO privacy scoring

ChainForensics is a powerful, privacy-focused Bitcoin blockchain analysis tool that runs entirely on your own node. Analyze transactions, trace fund flows, detect CoinJoin transactions, and assess the privacy of your UTXOs - all without leaking any data to third parties.

Key Features:
  - KYC Privacy Check - Trace funds backward to find exchange connections
  - Cluster Detection - Find linked addresses using common input ownership heuristic
  - Exchange Proximity - Measure how many hops you are from known exchanges
  - UTXO Privacy Rating - Score each UTXO's privacy (Red/Yellow/Green)
  - Transaction Analysis - Deep dive into any transaction
  - Address Lookup - View balance, transactions, and UTXOs for any address
  - Entity Recognition - Identify known wallets and services
  - Wallet Fingerprinting - Detect wallet software patterns


All analysis runs locally on your Bitcoin node and Fulcrum server. Your addresses and queries never leave your network.

## Inter-App Connections

This package integrates with **bitcoin, fulcrum** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `1.2.0-patch.1`
- **Website**: https://github.com/manic-startup/chainforensics-umbrel
- **Source Repository**: https://github.com/manic-startup/chainforensics-umbrel
- **Support**: https://github.com/manic-startup/chainforensics-umbrel/issues
