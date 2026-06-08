# JUPITER web root

This is the canonical Node.js/Express root for the local device UI.

- `server.js`: Express application and API compatibility layer.
- `views/`: `express-handlebars` pages.
- `public/`: static CSS, JavaScript and generated telemetry JSON.
- `config/`: local UI configuration consumed by the web API and monitor compatibility paths.
- `package.json`: Node dependencies expected in the Buildroot image.

Legacy CGI executables live in `/usr/libexec/jupiter/legacy-cgi` as migration reference only. Express serves equivalent `/cgi-bin/...` routes directly.

The local provisioning endpoint remains `/cgi-bin/jupiter-config` for browser compatibility. It updates the device identity, site metadata and MQTT connection fields used by the embedded monitor.
