# Fedimint Lightning Gateway

> Lightning routing for Fedimints

The Fedimint Lightning Gateway is an ecash wallet that connects Fedimint users to the broader Lightning Network. Operators can earn fees by providing outbound and inbound Lightning liquidity via their existing LND node.
# Key Characteristics
 - Trust Model: Just like a Lightning node, a Lightning Gateway is not a custodian of the payments it is routing. Lightning Gateways should trust the federations they provide liquidity services to, but users do not need to trust the Lightning Gateway.

 - Multi-federation support: A single gateway can service multiple Fedimints simultaneously and swap ecash when payments occur between federations, bypassing the Lightning Network altogether.

 - Liquidity Management: Also like a Lightning node, gateways must maintain ecash balances in each federation to facilitate incoming payments, similar to inbound liquidity in Lightning.

# Operating a Lightning Gateway
If you also use Lightning Terminal, keep it stopped while using Fedimint Gateway to avoid a connection conflict.
1. Installing a Lightning Gateway is easy, just one click and it connects to your already provisioned LND node!
2. Make sure your LND node has sufficient connectivity to the broader Lightning Network, ideally with balanced outbound and inbound liquidity.
3. Operators must then connect to a federation using the federation's invite code.
4. After connected, operators must pegin some ecash to the federation so that there is inbound liquidity.
5. After the operator has obtained the ecash, the connection URL of the Lightning Gateway can be provided to the guardians. The guardians will then advertise that this Lightning Gateway is providing Lightning services to the federation.
  
6. All set! The Fedimint can now send and receive payments over the Lightning Network.

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **bitcoin, lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `v0.12.2`
- **Website**: https://fedimint.org/
- **Source Repository**: https://github.com/fedimint/fedimint
- **Support**: https://github.com/fedimint/fedimint/issues
