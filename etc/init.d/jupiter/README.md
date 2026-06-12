# JUPITER device configuration

This directory is the canonical configuration root for the device image.

- `device.json`: local immutable identity, firmware version and provisioning status.
- `fleet.json`: tenant, site and rollout channel metadata.
- `hardware.json`: GPIO, relay and analog input mapping.
- `network.json`: LAN, LTE, VPN and NAT intent.
- `i2c.json`: I2C bus devices registered during boot.
- `leds.json`: WS2812/Jupiter LED device mapping and VIN indicator behavior.
- `telemetry.json`: telemetry polling and local state file locations.
- `mqtt.json`: compatibility configuration consumed by the current monitor binary.
- `secrets.env`: generated during provisioning; must not be committed with production secrets.
- `config.d/virtual_inputs.json`: SNMP/equipment configuration delivered by backend provisioning.

Provisioning can be done through the local web UI or with:

```sh
jupiter-provision DEVICE_ID MQTT_PASSWORD TENANT SITE_ID SITE_NAME MQTT_HOST MQTT_PORT
```

The current MQTT topic contract follows the broker ACL model:

```text
jupiter/{device_id}/telemetry
jupiter/{device_id}/status
jupiter/{device_id}/cmd
jupiter/{device_id}/config
```

The MQTT username must match `device_id`. Runtime secrets belong in `/etc/jupiter/secrets.env`; keep `mqtt.json` free of production passwords in firmware overlays.

Runtime state belongs in `/var/lib/jupiter/state`, logs belong in `/var/log/jupiter`, and executable services belong in `/usr/bin`.
