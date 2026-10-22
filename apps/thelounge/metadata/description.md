# The Lounge

> Modern web IRC client designed for self-hosting

The Lounge is a modern, open-source, web-based IRC (Internet Relay Chat) client that offers persistent connectivity, allowing users to remain connected to IRC servers even while offline, and provides a responsive interface compatible with desktops, smartphones, and tablets.

It brings IRC into the 21st century with features like push notifications, link previews, and file uploads, and supports multiple user accounts, enabling server sharing among friends or team members.

The Lounge can be installed on a continuously running server for optimal performance, granting users access through their browsers or mobile devices.

It offers both private mode, combining the functionalities of a bouncer and a client for a modern chat experience, and public mode, allowing open chat access without registration.

## User Management
- **User Creation**: The Lounge requires adding users via the command line. Run:
  ```bash
  docker exec -it thelounge-thelounge-1 s6-setuidgid node thelounge add <username>
  ```
  Follow the on-screen prompt to set your password.

## Links
- **Upstream Version**: `4.4.3`
- **Website**: https://thelounge.chat
- **Source Repository**: https://github.com/thelounge/thelounge
- **Support**: https://github.com/thelounge/thelounge/issues
