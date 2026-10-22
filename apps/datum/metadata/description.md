# DATUM

> Self-sovereign Bitcoin mining

⚙️ Please read the important setup instructions at the bottom of this page.

DATUM (Decentralized Alternative Templates for Universal Mining) is a brand new bitcoin mining protocol that allows you to create your own block templates using your own Bitcoin node.

With DATUM on Runtipi, you gain full control over your Bitcoin mining setup, allowing you to use your own Bitcoin node to generate custom block templates and directly issue work to your miners. DATUM enables you to either solo mine or participate in pool mining while optimizing block creation without relying on third-party servers.

Over the years, mining has drifted toward centralization, with large pools dominating the process and reducing miners to mere sellers of hash power. DATUM seeks to bring back the core principle of Bitcoin: decentralization, giving miners direct control over the block construction process once again.

🛠️ SET-UP INSTRUCTIONS

### Bitcoin Node:

DATUM connects automatically to the Bitcoin node selected during installation. Bitcoin Knots is recommended for its additional block-template policy controls, but Bitcoin Core and other compatible nodes can also be used. A full archival node is not required for mining, so pruning can be enabled in the selected node's settings.

### Configuring DATUM:

⚠️ The DATUM team is aware that Safari currently cannot be used to change configuration settings within the app. Please use a different browser to change settings.

In order for DATUM to be fully initialized, you need to add your Bitcoin address in the "Config" tab within the DATUM app. This is the default address that mining rewards will be sent to. Your in-app credentials needed to change settings can be found by right-clicking on the DATUM app icon from your Runtipi homescreen and selecting "Show default credentials".

### Connecting Your Miner:

Refer to your miner's documentation for specific setup details. Here's a general guide to connect your miner with Datum:

  - Stratum URL/Host/Pool: Use your Runtipi device’s IP address (found in Settings on the Runtipi home screen) and port 23334.
  e.g., stratum+tcp://192.168.4.56:23334

  - Username/Worker: Enter the Bitcoin address for receiving OCEAN rewards. Optionally, add a worker name after a period to identify your miner.
  e.g., bc1qabcdefghijklmnopqrstuvwxyz or bc1qabcdefghijklmnopqrstuvwxyz.bitaxe

  - Password: Leave blank or enter any value if your miner requires a password.


For more information on Datum, please visit https://github.com/OCEAN-xyz/datum_gateway

## Default Credentials
- **Username**: `admin`
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `v0.4.1-beta-hotfix.2`
- **Website**: https://ocean.xyz
- **Source Repository**: https://github.com/OCEAN-xyz/datum_gateway
- **Support**: https://ocean.xyz
