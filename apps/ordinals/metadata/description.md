# Ordinals

> Run your own index, block explorer, and command-line wallet for Ordinals

Run your own index, block explorer, and command-line wallet for Ordinals. The app automatically connects to your Bitcoin node on Runtipi for trustless operation. Simply install the app and wait for Ordinals to index inscriptions and runes.

Use the block explorer to view Ordinal inscriptions. Search blocks, transactions, outputs, and individual satoshis.

Advanced users can use the command line to create wallets, create and manage inscriptions, and more.

Optional indexes (Runtipi 2.0 or later): Open Ordinals' app settings, then Advanced → Environment variables. Address lookups, individual satoshi tracking and local inscription transaction storage are off by default. Select true for the features you want, or App default (off) to turn them off for your next index. Inscriptions and runes stay on.

Rebuilding the Ordinals index (Runtipi 2.0 or later)

Changing these options requires rebuilding the index, even if indexing has not finished. Rebuilding starts from scratch and may take several days. Saving a setting and restarting alone will keep the existing index.

1. Right-click Ordinals on your home screen and choose Settings → Advanced → Environment variables. Choose your options, click Apply and restart, and wait for the restart to finish.

2. Right-click Ordinals again, choose Stop, and wait until it has fully stopped.

3. Open Files → Apps → ordinals → data → ord. Right-click only index.redb and choose Trash. Keep the wallets folder and all other files: they can contain wallet data and pending etchings. If you use a test network, index.redb is inside its subfolder (testnet3, testnet4, signet or regtest).

4. Click Ordinals on your home screen to start it. It will build a new index with your chosen settings. To check the active indexes and progress, open Ordinals and add /status to its address in your browser.

The old index stays in Trash and still uses disk space. Once you are satisfied with the new index, you can remove only that old index.redb file from Trash to reclaim the space. Rebuilding the blockchain index does not fix older, incompatible command-line wallets.

Disclaimer: The Ordinals app does not control, filter, or moderate the content hosted on the Bitcoin blockchain. Consequently, you may come across NSFW (Not Safe For Work), objectionable, or unlawful material while using the app.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `0.29.1`
- **Website**: https://ordinals.com/
- **Source Repository**: https://github.com/casey/ord
- **Support**: https://discord.gg/ordinals
