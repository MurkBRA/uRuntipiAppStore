# SatSale

> Lightweight Bitcoin payment processor

SatSale is a simple, easily deployable, lightweight Bitcoin payment processor that connects to your own Bitcoin node. You can use SatSale to instantly turn your Runtipi into a point-of-sale (settings under /admin). SatSale can process donations from your supporters, facilitating direct peer-to-peer payments without any middleman and greater privacy than reusing donation addresses.

Host your own Bitcoin payment gateway for Woocommerce without a middleman or custodian, allowing you to turn any wordpress site into a bitcoin-accepting store.

This Runtipi app contains a subset of the features we have in the works for SatSale, but will push updates out as they are ready. Check out the website and GitHub for more!

Please note that SatSale is still in early development. As such, we are not responsible for any loss of funds, vulnerabilities, or any other grievances which arise. Always confirm large payments manually and use cold storage as much as possible. Please contribute if you can!

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.1.13-build-1-patch.1`
- **Website**: https://satsale.org
- **Source Repository**: https://github.com/nickfarrow/SatSale/
- **Support**: https://github.com/nickfarrow/SatSale/issues
