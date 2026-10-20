# Go Brrr Pool

> Bitcoin Solo Mining, Done Right!

Go Brrr Pool is a self-hosted solo Bitcoin mining pool powered by ckpool-solo. Connect your miners directly to your own node and keep 100% of block rewards. No third-party pool, no KYC, no fees, no middleman.

Features a customizable real-time web dashboard with hashrate monitoring, worker statistics, pool-wide leaderboard, efficiency dashboard, and local mempool API integration, using your local Mempool app when installed. ZMQ enables instant block notifications and automatic difficulty adjustment accepts diff proposals from miners.

Two stratum ports: port 21420 for standard mining, port 21422 for high-difficulty mode (min diff 1,000,000) suited for powerful machines and hashrate rentals. Workers connect using their Bitcoin address as the username — any block found pays out directly and entirely to the miner's own wallet.

Built on ckpool, the same battle-tested open-source pool software powering solo.ckpool.org.

This software is free as in FREEDOM!

Homescreen widget developed by RodB.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `1.2.1-patch.2`
- **Website**: https://gobrrr.me
- **Source Repository**: https://github.com/gobrrrme/GoBrrr-Pool
- **Support**: https://github.com/gobrrrme/GoBrrr-Pool/issues
