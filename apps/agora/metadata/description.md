# Agora

> Sell your files for Bitcoin

Agora is a project that allows anyone to sell files on the web for bitcoin using the Lightning Network.

Agora serves the contents of a local directory, providing file listings and downloads over HTTP. For example, you can point it at a directory full of PDFs, allowing users to browse and view the PDFs in their web browser. If agora is connected to an LND node, it can be configured to require Lightning Network payments for downloads.

## Default Credentials
- **Username**: `umbrel`
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.1.2`
- **Website**: https://agora-org.github.io/agora/
- **Source Repository**: https://github.com/agora-org/agora
- **Support**: https://t.me/agoradiscussion
