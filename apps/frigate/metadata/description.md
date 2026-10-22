# Frigate

> A complete and local NVR

A complete and local NVR designed for Home Assistant with AI object detection.  Uses OpenCV and Tensorflow to perform realtime object detection locally for IP cameras.

🛠️ SET-UP

- You can configure your cameras directly within the Frigate app, there is no need to manually edit the configuration files.

- Sign in to Frigate with username `admin`. The initial admin password is automatically generated on first boot and printed in the container console/logs (see Default Credentials below).

- The RTSP stream password (used for camera feeds / go2rtc) is configured in your Runtipi app settings via `APP_RTSP_PASSWORD`.

## Default Credentials
- **Username**: `admin`
- **Password**: Generated automatically in the container console/logs on first launch. View your container logs (`docker logs frigate` or check the Runtipi logs viewer) to retrieve your initial password.
- **Password Reset**: If you need to reset the admin password later, set `auth.reset_admin_password: true` in your Frigate configuration and restart the container.
- **RTSP Stream Password**: Configured via the `APP_RTSP_PASSWORD` field in your Runtipi app configuration.

## Links
- **Upstream Version**: `0.18.2`
- **Website**: https://frigate.video/
- **Source Repository**: https://github.com/blakeblackshear/frigate
- **Support**: https://github.com/blakeblackshear/frigate/issues
