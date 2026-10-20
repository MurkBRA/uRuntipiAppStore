# sat.watch

> Bitcoin monitoring and real-time alerts

sat.watch provides real-time monitoring of your Bitcoin.
Features:
  - Monitor Bitcoin addresses, xpubs, or descriptors
  - Alerts for funds sent or received
  - Monitors the mempool and confirmed blocks
  - Total balance summary for all addresses monitored
  - Email and webhook notifications
  - PGP encrypted email

## Default Credentials
- **Username**: `satwatch`
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **bitcoin, electrs** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `1.1.8`
- **Website**: https://sat.watch
- **Source Repository**: https://github.com/jpcummins/sat.watch
- **Support**: https://github.com/jpcummins/sat.watch/issues
