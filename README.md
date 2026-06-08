# JUPITER Buildroot Overlay

This overlay is organized by runtime responsibility:

- `/etc/jupiter`: declarative device configuration and non-secret defaults.
- `/usr/bin`: public service entrypoints and operational commands.
- `/usr/libexec/jupiter`: internal helpers and legacy compatibility executables.
- `/www/jupiter`: local Node.js/Express web application.
- `/var/lib/jupiter`: runtime state generated on the device.
- `/var/log/jupiter`: runtime logs generated on the device.

The local web UI is served by `/usr/bin/jupiter-web`, which starts `/www/jupiter/server.js`.
Legacy `/cgi-bin/...` HTTP paths are still exposed by Express for browser compatibility; old CGI executables are archived under `/usr/libexec/jupiter/legacy-cgi`.

Do not store production secrets in this overlay. Runtime MQTT credentials belong in `/etc/jupiter/secrets.env`.
