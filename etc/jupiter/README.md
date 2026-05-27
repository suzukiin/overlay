# JUPITER device configuration

This directory is the canonical configuration root for the device image.

- `device.json`: local immutable identity, firmware version and provisioning status.
- `fleet.json`: tenant, site and rollout channel metadata.
- `hardware.json`: GPIO, relay and analog input mapping.
- `network.json`: LAN, LTE, VPN and NAT intent.
- `telemetry.json`: telemetry polling and local state file locations.
- `mqtt.json`: compatibility configuration consumed by the current monitor binary.
- `secrets.env`: generated during provisioning; must not be committed with production secrets.
- `config.d/virtual_inputs.json`: SNMP/equipment configuration delivered by backend provisioning.

Runtime state belongs in `/var/lib/jupiter/state`, logs belong in `/var/log/jupiter`, and executable services belong in `/usr/bin`.
