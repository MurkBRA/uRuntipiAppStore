# Solidtime

> A simple, secure, and private time tracking app

🕒 Solidtime is a simple, secure, and private time tracking app that helps you keep track of your time and stay productive. It's designed to be easy to use and respects your privacy by storing your data locally.

📊 Features:
  - Track your time with a simple and intuitive interface
  - View detailed reports of your time usage
  - Export your data to CSV for further analysis
  - Secure and private: your data is stored locally on your Runtipi

⚠️ New users can only be created via the terminal for now. Example:
`sudo docker exec -i solidtime_scheduler_1 bash -c "echo '<password' | php artisan admin:user:create '<username>' '<email>' --ask-for-password --verify-email"`

💻 To be able to use the Desktop Client, a Client ID is needed. 
  - Use the Runtipi Files App and navigate to **Apps/Solidtime**
  - A file called `desktop_client_id.txt` can be found there that contains the ID that you need to get started


The application takes a few minutes until it becomes available after installation. Please be patient.

## User Management
- **Initial User Creation**: Create your administrator user via the terminal command shown in the setup instructions above:
  ```bash
  docker exec -i solidtime-scheduler-1 bash -c "echo '<password>' | php artisan admin:user:create '<username>' '<email>' --ask-for-password --verify-email"
  ```
- **Admin Email Configuration**: Configured via `SUPER_ADMINS` in your Runtipi app settings (default: `admin@tipi.local`).

## Links
- **Upstream Version**: `0.22.0`
- **Website**: https://www.solidtime.io/
- **Source Repository**: https://github.com/solidtime-io/solidtime
- **Support**: https://github.com/solidtime-io/solidtime/issues
