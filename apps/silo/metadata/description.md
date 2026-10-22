# Silo

> Store your files with an S3-compatible object server

Silo is a community-maintained, open-source object storage server with an S3-compatible API and a full web console. Organize files in buckets, upload and download objects, and manage access keys and policies from your browser.

Sign in with the credentials shown by Runtipi, create a bucket, and create a scoped access key for your backup software or S3 client. Connect clients to http://your-umbrel-ip:9131 using path-style addressing and region us-east-1. The console is available by opening Silo in Runtipi; the S3 endpoint uses Silo's own authentication rather than Runtipi login.

This installation uses a single local storage directory, not a redundant storage cluster. Keep independent backups. The S3 endpoint uses HTTP: use it only on a trusted network or through an encrypted connection such as Tailscale, and do not expose it directly to the internet.

## Default Credentials
- **Username**: `umbrel`
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Links
- **Upstream Version**: `2026.10.18`
- **Website**: https://silo.pgsty.com
- **Source Repository**: https://github.com/pgsty/silo
- **Support**: https://github.com/pgsty/silo/issues
