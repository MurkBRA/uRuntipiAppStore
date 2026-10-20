# Specter Desktop

> Multisig with hardware wallets made easy

Specter Desktop can be used to connect to the Bitcoin Core running on your Umbrel or an Electrum Server. It functions as a watch-only coordinator for multi-signature and single-key Bitcoin wallets. At the moment Specter Desktop is working with all major hardware wallets including:

- SeedSigner
- Specter DIY (optionally airgapped, using QR codes)
- Blockstream Jade
- ColdCard (optionally airgapped, using SD card)
- Passport
- BitBox02
- Electrum (optionally airgapped, if running Electrum on an airgapped computer/phone)
- Keystone (airgapped, using QR codes)
- Trezor
- Ledger
- KeepKey

Specter Desktop also supports using the Bitcoin Core on your Umbrel as a hot wallet, by importing or generating a random BIP39 mnemonic, but this feature is experimental and we do not recommend using it at this stage. We plan to add support for other hardware wallets as they come up.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `2.1.11-patch.1`
- **Website**: https://specter.solutions
- **Source Repository**: https://github.com/cryptoadvance/specter-desktop
- **Support**: https://t.me/spectersupport
