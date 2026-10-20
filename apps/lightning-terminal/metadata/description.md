# Lightning Terminal

> The easiest way to manage channel liquidity

Lightning Terminal is the easiest way to manage inbound and outbound liquidity on the Lightning Network. Keep your channels open and the funds flowing. It provides a visual interface for interacting with your channels and balances using Loop.

🚨 CRITICAL REMINDER FOR TAPROOT ASSETS USERS:
Uninstalling this app permanently erases application data, which includes Taproot Assets and Bitcoin funds. Before uninstalling or re-installing this app, you must backup the application's .tapd data folder in order to restore your taproot assets upon reinstallation. Failure to do so will result in permanent loss of funds. We recommend that you make regular backups. Follow this guide to backup your tapd data: https://community.umbrel.com/t/backing-up-taproot-assets-tapd-data-in-lightning-terminal/14360

Why use Pool?
- Earn a return on Lightning capital
- Rent a channel and start accepting payments instantly
- Open channels for less with transaction batching

Why use Loop?
- Add "inbound liquidity" to receive payments
- Reduce transaction fees by recycling and reusing Lightning channels
- Send funds to and from users or services that aren't yet Lightning enabled
- Configurable wait times and "batching" allow for further fee savings
- Refill and offload funds from any number of Lightning channels in a single on-chain transaction

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.17.6`
- **Website**: https://lightning.engineering
- **Source Repository**: https://github.com/lightninglabs/lightning-terminal
- **Support**: https://github.com/lightninglabs/lightning-terminal/issues/new
