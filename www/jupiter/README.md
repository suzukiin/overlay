# JUPITER web root

This is the canonical Node.js/Express root for the local device UI.

- `server.js`: Express application and API compatibility layer.
- `views/`: `express-handlebars` pages.
- `public/`: static CSS, JavaScript and generated telemetry JSON.
- `config/`: legacy UI configuration kept for migration reference; runtime data is read from `/home/proc`.
- `package.json`: Node dependencies expected in the Buildroot image.

Legacy CGI executables live in `/usr/libexec/jupiter/legacy-cgi` as migration reference only. Express serves equivalent `/cgi-bin/...` routes directly.
