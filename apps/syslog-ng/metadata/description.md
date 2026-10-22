# Syslog-ng

> Centralized syslog server with real-time web UI

Syslog-ng is a flexible, highly scalable syslog server that collects logs from all your network devices. It supports both BSD (RFC3164) and IETF (RFC5424) syslog formats, making it compatible with virtually any router, switch, access point, or server.

Includes a real-time log viewer with search and filtering capabilities, accessible through your browser.

Simply configure your network devices to send syslog messages to your Runtipi's IP address on UDP port 514 or TCP port 601.

Features:
  - Supports BSD/RFC3164 format (used by most routers including Ubiquiti, Alta Labs, etc.)
  - Supports IETF/RFC5424 format
  - UDP 514 and TCP 601 listeners
  - Real-time web UI with search and filtering
  - Persistent log storage

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Links
- **Upstream Version**: `4.10.2-1-patch.1`
- **Website**: https://www.syslog-ng.com/
- **Source Repository**: https://github.com/syslog-ng/syslog-ng
- **Support**: https://github.com/syslog-ng/syslog-ng/issues
