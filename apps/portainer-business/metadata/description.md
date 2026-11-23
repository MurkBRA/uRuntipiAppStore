# Portainer Business

> Manage Docker containers on your Runtipi with Portainer Business Edition

⚠️ Portainer Business Edition needs a license key from Portainer. You'll be asked for it after you sign in for the first time. Portainer offers a free license for up to 3 nodes at portainer.io/take-3.

⚠️ Make sure to only use named Docker volumes for your stacks and containers. Data in bind-mounted volumes will be lost when the Portainer app is restarted or updated.

⚠️ Watch out for port conflicts between your custom Docker containers and your Runtipi apps.

Portainer Business Edition is the commercial edition of Portainer. It adds features for teams and businesses on top of the Community Edition, such as role-based access control, registry management, and support from Portainer. If you don't need these features, install the free Portainer app instead.

🛠️ Portainer on Runtipi is for power users, follow these best practices to avoid issues:

1. Data persistence: Make sure to only use named Docker volumes for your stacks and containers. Data in bind-mounted volumes will be lost when the Portainer app is restarted or updated.

2. Port management: Watch out for potential port conflicts between your custom containers and Runtipi' service containers, apps you have installed from the Runtipi App Store or Community App Stores, and any apps you go to install in the future.

3. Container restart policy: Set your containers to "unless-stopped" or "always" restart policies. This will allow your containers to restart automatically when the Portainer app is restarted or updated.

4. Web access to containers: Access your custom containers in your browser at <IP-DO-SERVIDOR>:PORT_NUMBER. For example, for a container with a web UI running on port 4545, navigate to <IP-DO-SERVIDOR>:4545 to access it.

## Default Credentials
- **Username**: `admin`
- **Password**: `changeme`

## Links
- **Upstream Version**: `2.45.4`
- **Website**: https://www.portainer.io
- **Source Repository**: https://www.portainer.io
- **Support**: https://www.portainer.io/resources/get-support
