# Nostr VPN

> Admin-approved mesh VPN over Nostr

Nostr VPN turns your Runtipi into a private mesh VPN node for your own devices and trusted groups. Approve signed join-request QRs, manage peers, and route traffic through trusted exit nodes without relying on a hosted VPN provider or a central control server.

Before updating or uninstalling this app, turn VPN off using the switch inside Nostr VPN and wait until it shows "VPN off". This releases connection protection so Runtipi can access the Internet. VPN routing and protection are paused until you turn VPN back on. Use a local connection to Runtipi for these steps.

To connect a device, choose Join on the device you want to add so it displays its signed QR code or link. On your Runtipi, scan or paste that request, review it, and accept it. The joining device then receives the signed network roster and your devices can reach each other using their private Nostr VPN IPs.

## Links
- **Upstream Version**: `v4.1.20`
- **Website**: https://github.com/mmalmi/nostr-vpn
- **Source Repository**: https://github.com/mmalmi/nostr-vpn
- **Support**: https://github.com/mmalmi/nostr-vpn/issues
