"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const net = require("net");
const { execFile } = require("child_process");
const express = require("express");
const { engine } = require("express-handlebars");

const app = express();
const port = Number(process.env.JUPITER_WEB_PORT || 80);
const deviceRoot = process.env.JUPITER_DEVICE_ROOT || path.resolve(__dirname, "../..");

function devicePath(absolutePath) {
  return path.join(deviceRoot, absolutePath.replace(/^\/+/, ""));
}

const paths = {
  webLog: devicePath("/var/log/jupiter/web.log"),
  info: devicePath("/www/jupiter/config/info.json"),
  virtualInputs: devicePath("/www/jupiter/config/virtual_inputs.json"),
  telemetryData: devicePath("/www/jupiter/public/telemetry_data.json"),
  device: devicePath("/etc/jupiter/device.json"),
  legacyDevice: devicePath("/etc/jupiter/jupiter.json"),
  fleet: devicePath("/etc/jupiter/fleet.json"),
  mqtt: devicePath("/etc/jupiter/mqtt.json"),
  secrets: devicePath("/etc/jupiter/secrets.env"),
  relaySchedule: devicePath("/etc/jupiter/relay_schedule.json"),
  relayState: devicePath("/var/lib/jupiter/state/relay_state"),
  legacyRelayState: devicePath("/etc/jupiter/relay_state"),
  adsCalibration: devicePath("/var/lib/jupiter/state/ads1015_calibration"),
  watchdogLog: devicePath("/var/log/watchdog.log"),
  systemLog: devicePath("/var/log/jupiter/system.log"),
  thermal: devicePath("/sys/class/thermal/thermal_zone0/temp"),
  netDev: devicePath("/proc/net/dev"),
  ttyUsb1: devicePath("/dev/ttyUSB1"),
  relay1: devicePath("/dev/relay1"),
  relay2: devicePath("/dev/relay2"),
  vinStatus: devicePath("/dev/vin_status"),
  ledDevice: devicePath("/dev/jupiter_leds"),
  jupiterLed: devicePath("/usr/bin/jupiter-led"),
  adsDir: devicePath("/var/lib/jupiter/iio/ads1015")
};

app.engine("handlebars", engine({ defaultLayout: false }));
app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/public", express.static(path.join(__dirname, "public")));

function logLine(level, message) {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  ensureDir(paths.webLog)
    .then(() => fsp.appendFile(paths.webLog, line))
    .catch(() => {});
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logLine("access", `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

function ok(data = {}) {
  return { status: "Success", data };
}

function error(msg) {
  return { status: "Error", msg };
}

async function exists(file) {
  try {
    await fsp.access(file, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(file) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
}

async function readText(file) {
  return fsp.readFile(file, "utf8");
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readText(file));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await ensureDir(file);
  await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function writeText(file, data, mode = 0o644) {
  await ensureDir(file);
  await fsp.writeFile(file, data, { mode });
}

function validKey(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]+$/.test(value);
}

function validHost(value) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]+$/.test(value);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shellQuote(value) {
  return String(value).replace(/'/g, "'\\''");
}

app.get(["/", "/index.html"], (req, res) => {
  res.render("dashboard");
});

app.get(["/cgi-bin/get-info-navbar", "/api/info-navbar"], async (req, res) => {
  const info = await readJson(paths.info);
  if (!info) {
    res.json(error("Nao foi possivel abrir o arquivo de configuracao"));
    return;
  }
  res.json(ok(info));
});

app.get(["/cgi-bin/get-uptime", "/api/uptime"], (req, res) => {
  readText(devicePath("/proc/uptime"))
    .then((content) => {
      const total = Math.floor(Number(content.trim().split(/\s+/)[0]));
      const dias = Math.floor(total / 86400);
      const horas = Math.floor((total % 86400) / 3600);
      const minutos = Math.floor((total % 3600) / 60);
      res.json(ok({ dias, horas, minutos }));
    })
    .catch(() => {
      const total = Math.floor(os.uptime());
      const dias = Math.floor(total / 86400);
      const horas = Math.floor((total % 86400) / 3600);
      const minutos = Math.floor((total % 3600) / 60);
      res.json(ok({ dias, horas, minutos }));
    });
});

app.get(["/cgi-bin/get-traffic", "/api/traffic"], async (req, res) => {
  try {
    const content = await readText(paths.netDev);
    const line = content.split("\n").find((item) => item.trim().startsWith("ppp0:"));
    if (!line) {
      res.json(error("Interface ppp0 nao encontrada"));
      return;
    }

    const [, values] = line.split(":");
    const parts = values.trim().split(/\s+/).map(Number);
    const rx = parts[0] || 0;
    const tx = parts[8] || 0;
    res.json(ok({
      interface: "ppp0",
      rx_mb: Number((rx / 1024 / 1024).toFixed(2)),
      tx_mb: Number((tx / 1024 / 1024).toFixed(2))
    }));
  } catch {
    res.json(error("Nao foi possivel abrir o arquivo"));
  }
});

app.get(["/cgi-bin/get-temp-cpu", "/api/temp-cpu"], async (req, res) => {
  try {
    const raw = Number((await readText(paths.thermal)).trim());
    if (!Number.isFinite(raw)) {
      res.json(error("Formato invalido da temperatura"));
      return;
    }
    res.json(ok({ raw, celsius: Number((raw / 1000).toFixed(1)) }));
  } catch {
    res.json(error("Nao foi possivel abrir o arquivo de temperatura"));
  }
});

app.get(["/cgi-bin/get-log-watchdog", "/api/log-watchdog"], async (req, res) => {
  const file = await exists(paths.watchdogLog) ? paths.watchdogLog : paths.systemLog;
  try {
    const lines = (await readText(file)).split(/\r?\n/).filter(Boolean);
    res.json({ status: "Success", logs: lines });
  } catch {
    res.json(error("Nao foi possivel abrir o log"));
  }
});

function checkInternet() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "8.8.8.8", port: 53, timeout: 2000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

app.get(["/cgi-bin/get-status-vpn", "/api/status-vpn"], async (req, res) => {
  if (await checkInternet()) {
    res.json({ status: "Success", internet: "online" });
  } else {
    res.json({ status: "Error", internet: "offline" });
  }
});

function execShell(script, timeout = 3500) {
  return new Promise((resolve) => {
    execFile("/bin/sh", ["-c", script], { timeout }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
}

app.get(["/cgi-bin/get-rssi", "/api/rssi"], async (req, res) => {
  if (!(await exists(paths.ttyUsb1))) {
    res.json(error("Erro ao abrir porta"));
    return;
  }

  const script = [
    `stty -F ${paths.ttyUsb1} 115200 raw -echo -icanon min 0 time 10 2>/dev/null || true`,
    `printf 'ATE0\\r\\n' > ${paths.ttyUsb1}`,
    "sleep 0.1",
    `printf 'AT+CSQ\\r\\n' > ${paths.ttyUsb1}`,
    `timeout 2 cat ${paths.ttyUsb1}`
  ].join("; ");
  const { stdout } = await execShell(script);
  const match = stdout.match(/\+CSQ:\s*(\d+),\s*(\d+)/);

  if (!match) {
    res.json(error("Sem resposta valida do modem"));
    return;
  }

  res.json(ok({ rssi: Number(match[1]) }));
});

async function readRelayState() {
  const state = { relay1: false, relay2: false };

  async function readRelay(file, fallbackIndex) {
    try {
      return (await readText(file)).trim() === "1";
    } catch {
      try {
        const persisted = (await readText(paths.relayState)).trim().split(/\s+/);
        return persisted[fallbackIndex] === "1";
      } catch {
        return false;
      }
    }
  }

  state.relay1 = await readRelay(paths.relay1, 0);
  state.relay2 = await readRelay(paths.relay2, 1);
  return state;
}

async function persistRelayState(state) {
  const content = `${state.relay1 ? 1 : 0} ${state.relay2 ? 1 : 0}\n`;
  await writeText(paths.relayState, content);
  await writeText(paths.legacyRelayState, content);
}

app.get(["/cgi-bin/relay-control", "/api/relay-control"], async (req, res) => {
  res.json(ok(await readRelayState()));
});

app.post(["/cgi-bin/relay-control", "/api/relay-control"], async (req, res) => {
  const relay = Number(req.query.relay);
  const value = Number(req.query.state);

  if (![1, 2].includes(relay) || ![0, 1].includes(value)) {
    res.json(error("Invalid relay or state value"));
    return;
  }

  const file = relay === 1 ? paths.relay1 : paths.relay2;
  try {
    if (await exists(file)) {
      await writeText(file, `${value}\n`);
    }
    const state = await readRelayState();
    state[`relay${relay}`] = value === 1;
    await persistRelayState(state);
    res.json(ok(state));
  } catch {
    res.json(error("Failed to write relay state"));
  }
});

app.get(["/cgi-bin/get-vin-status", "/api/vin-status"], async (req, res) => {
  try {
    const raw = (await readText(paths.vinStatus)).trim();
    const present = raw === "1";
    res.json(ok({
      raw,
      vin_status: Number(raw),
      vin_present: present,
      power_mode: present ? "normal" : "battery"
    }));
  } catch {
    res.json(error("VIN status not available"));
  }
});

app.get(["/cgi-bin/led-control", "/api/led-control"], async (req, res) => {
  const ledAvailable = await exists(paths.ledDevice);
  const state = await readText(devicePath("/var/lib/jupiter/state/leds_state")).catch(() => "");
  res.json(ok({
    available: ledAvailable,
    device: "/dev/jupiter_leds",
    state: state.trim()
  }));
});

app.post(["/cgi-bin/led-control", "/api/led-control"], async (req, res) => {
  const led = String(req.query.led ?? req.body?.led ?? "").trim();
  const color = String(req.query.color ?? req.body?.color ?? "").trim();
  const validColors = new Set(["off", "red", "green", "blue", "yellow", "magenta", "cyan", "white", "orange"]);

  if (!/^[0-5]$/.test(led) || !validColors.has(color)) {
    res.json(error("Invalid led or color"));
    return;
  }

  execFile(paths.jupiterLed, ["set", led, color], {
    timeout: 2000,
    env: {
      ...process.env,
      JUPITER_COMMON: devicePath("/usr/bin/jupiter-common"),
      JUPITER_LED_DEV: paths.ledDevice,
      JUPITER_LED_STATE: devicePath("/var/lib/jupiter/state/leds_state")
    }
  }, async (err) => {
    if (err) {
      res.json(error("Failed to set led"));
      return;
    }

    const state = await readText(devicePath("/var/lib/jupiter/state/leds_state")).catch(() => "");
    res.json(ok({
      available: true,
      led: Number(led),
      color,
      state: state.trim()
    }));
  });
});

app.get(["/cgi-bin/relay-schedule", "/api/relay-schedule"], async (req, res) => {
  const schedule = await readJson(paths.relaySchedule, {
    schema_version: 1,
    enabled: true,
    timezone: "local",
    rules: []
  });
  res.json(ok(schedule));
});

app.post(["/cgi-bin/relay-schedule", "/api/relay-schedule"], async (req, res) => {
  const data = req.body || {};
  const schedule = {
    schema_version: Number(data.schema_version) || 1,
    enabled: Boolean(data.enabled),
    timezone: data.timezone || "local",
    rules: Array.isArray(data.rules) ? data.rules : []
  };
  try {
    await writeJson(paths.relaySchedule, schedule);
    res.json(ok(schedule));
  } catch {
    res.json(error("Erro ao salvar configuracao"));
  }
});

async function readAdsCalibration(channel) {
  try {
    const line = (await readText(paths.adsCalibration))
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${channel} `));
    if (line) {
      const [, gain, offset] = line.trim().split(/\s+/);
      return {
        gain: numberOr(gain, 3.060606),
        offset: numberOr(offset, 0)
      };
    }
  } catch {
    // Defaults below.
  }
  return { gain: 3.060606, offset: 0 };
}

async function writeAdsCalibration(channel, gain, offset) {
  let lines = [];
  try {
    lines = (await readText(paths.adsCalibration)).split(/\r?\n/).filter(Boolean);
  } catch {
    lines = [];
  }
  lines = lines.filter((line) => !line.trim().startsWith(`${channel} `));
  lines.push(`${channel} ${gain} ${offset}`);
  await writeText(paths.adsCalibration, `${lines.join("\n")}\n`);
}

async function readAdsChannel(channel) {
  const rawPath = path.join(paths.adsDir, `in_voltage${channel}_raw`);
  const scalePath = await exists(path.join(paths.adsDir, `in_voltage${channel}_scale`))
    ? path.join(paths.adsDir, `in_voltage${channel}_scale`)
    : path.join(paths.adsDir, "in_voltage_scale");
  const raw = Number((await readText(rawPath)).trim());
  const kernelScale = await exists(scalePath) ? numberOr((await readText(scalePath)).trim(), 1) : 1;
  const calibration = await readAdsCalibration(channel);
  const adsVoltage = raw * kernelScale;
  const voltage = (adsVoltage * calibration.gain) + calibration.offset;

  return {
    channel,
    raw,
    kernel_scale: kernelScale,
    ads_voltage: Number(adsVoltage.toFixed(6)),
    gain: calibration.gain,
    offset: calibration.offset,
    voltage: Number(voltage.toFixed(6)),
    unit: "V"
  };
}

app.get(["/cgi-bin/get-ads1015", "/api/ads1015"], async (req, res) => {
  try {
    const channels = [];
    for (let channel = 0; channel < 4; channel += 1) {
      channels.push(await readAdsChannel(channel));
    }
    res.json(ok({ channels }));
  } catch {
    res.json(error("ADS1015 not available"));
  }
});

app.post(["/cgi-bin/get-ads1015", "/api/ads1015"], async (req, res) => {
  const channel = Number(req.query.channel);
  const gain = Number(req.query.gain);
  const offset = Number(req.query.offset || 0);

  if (![0, 1, 2, 3].includes(channel) || !Number.isFinite(gain) || !Number.isFinite(offset)) {
    res.json(error("Invalid channel, gain or offset"));
    return;
  }

  try {
    await writeAdsCalibration(channel, gain, offset);
    const channels = [];
    for (let item = 0; item < 4; item += 1) {
      channels.push(await readAdsChannel(item));
    }
    res.json(ok({ channels }));
  } catch {
    res.json(error("ADS1015 not available"));
  }
});

async function getProvisionConfig() {
  const device = await readJson(paths.device, {});
  const legacyDevice = await readJson(paths.legacyDevice, {});
  const fleet = await readJson(paths.fleet, {});
  const mqtt = await readJson(paths.mqtt, {});
  const info = await readJson(paths.info, {});
  const deviceId = device.device_id || legacyDevice.device_id || mqtt.device_id || info.deviceId || "";
  const site = fleet.site || {};

  return {
    device_id: deviceId,
    client: info.client || fleet.tenant || "",
    location: info.location || site.name || "",
    site_id: info.siteId || site.id || "",
    site_name: info.siteName || site.name || "",
    city: info.city || site.city || "",
    state: info.state || site.state || "",
    fw_version: device.firmware_version || mqtt.fw_version || info.version || "0.0.1",
    mqtt_host: mqtt.host || "",
    mqtt_port: mqtt.port || 1883,
    mqtt_username: mqtt.username || deviceId,
    mqtt_client_id: mqtt.client_id || deviceId,
    has_mqtt_secret: await exists(paths.secrets)
  };
}

app.get(["/cgi-bin/jupiter-config", "/api/jupiter-config"], async (req, res) => {
  res.json(ok(await getProvisionConfig()));
});

app.post(["/cgi-bin/jupiter-config", "/api/jupiter-config"], async (req, res) => {
  const data = req.body || {};
  const deviceId = String(data.device_id || "").trim();
  const mqttPort = Number(data.mqtt_port || 1883);
  const mqttHost = String(data.mqtt_host || "").trim();
  const username = String(data.mqtt_username || deviceId).trim();
  const clientId = String(data.mqtt_client_id || deviceId).trim();
  const fwVersion = String(data.fw_version || "0.0.1").trim();

  if (!validKey(deviceId)) {
    res.json(error("Device ID invalido"));
    return;
  }
  if (username !== deviceId) {
    res.json(error("O usuario MQTT precisa ser igual ao Device ID"));
    return;
  }
  if (!validHost(mqttHost) || !Number.isInteger(mqttPort) || mqttPort < 1 || mqttPort > 65535) {
    res.json(error("MQTT host ou porta invalida"));
    return;
  }

  const siteId = data.site_id || "unknown-site";
  const siteName = data.site_name || data.location || String(siteId);
  const client = data.client || "lab-service";
  const city = data.city || "";
  const state = String(data.state || "").toUpperCase();
  const previousMqtt = await readJson(paths.mqtt, {});

  const device = {
    schema_version: 1,
    device_id: deviceId,
    serial_number: deviceId,
    model: "jupiter-telemetry",
    hardware_revision: "rev-a",
    firmware_version: fwVersion,
    provisioning: {
      mode: "factory",
      status: "provisioned"
    }
  };

  const fleet = {
    schema_version: 1,
    tenant: client,
    environment: "production",
    site: {
      id: siteId,
      name: siteName,
      city,
      state,
      country: "BR"
    },
    mqtt_topics: {
      base: "jupiter",
      pattern: "jupiter/{device_id}/{channel}"
    },
    update_channel: "stable"
  };

  const info = {
    location: data.location || siteName,
    client,
    deviceId,
    wanIp: "",
    lanIp: "",
    version: fwVersion,
    siteId,
    siteName,
    city,
    state
  };

  const mqtt = {
    ...previousMqtt,
    host: mqttHost,
    port: mqttPort,
    device_id: deviceId,
    username,
    password: "",
    client_id: clientId,
    fw_version: fwVersion,
    identity_file: "/etc/jupiter/device.json",
    info_file: "/www/jupiter/config/info.json",
    inputs_file: "/www/jupiter/config/virtual_inputs.json",
    output_file: "/www/jupiter/public/telemetry_data.json"
  };

  try {
    await writeJson(paths.device, device);
    await writeJson(paths.legacyDevice, { device_id: deviceId });
    await writeJson(paths.fleet, fleet);
    await writeJson(paths.info, info);
    await writeJson(paths.mqtt, mqtt);

    if (data.mqtt_password) {
      await writeText(paths.secrets, `# Generated by jupiter-web.\nJUPITER_MQTT_PASSWORD='${shellQuote(data.mqtt_password)}'\n`, 0o600);
    }

    res.json(ok(await getProvisionConfig()));
  } catch {
    res.json(error("Erro ao salvar provisionamento"));
  }
});

app.use((req, res) => {
  res.status(404).json(error("Not found"));
});

app.use((err, req, res, next) => {
  void next;
  logLine("error", `${req.method} ${req.originalUrl}: ${err.stack || err.message || err}`);
  res.status(500).json(error("Internal server error"));
});

app.listen(port, "0.0.0.0", () => {
  const message = `JUPITER web listening on 0.0.0.0:${port}`;
  console.log(message);
  logLine("info", message);
});
