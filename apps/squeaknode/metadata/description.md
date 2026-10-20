# Squeaknode

> A peer-to-peer status feed with Lightning monetization

Squeaknode is a peer-to-peer microblog with posts unlocked by Lightning Network payments. The app allows you to create, view, buy, and sell squeaks. A squeak is a post that can contain up to 280 characters.

The Squeaknode timeline is ordered by the height of the Bitcoin block hash embedded in each squeak. Each squeak must be signed with the private key of the author. Squeaks can be downloaded from any peer to any peer, but they remain locked until the downloader makes a Lightning payment to decrypt the content.

## Default Credentials
- **Username**: `umbrel`
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **bitcoin, lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.3.4-patch.1`
- **Website**: https://squeaknode.org
- **Source Repository**: https://github.com/squeaknode/squeaknode
- **Support**: https://github.com/squeaknode/squeaknode/discussions
