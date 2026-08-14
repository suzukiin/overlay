document.addEventListener("DOMContentLoaded", function () {
    const POLL_INTERVALS = {
        quick: 120000,
        slow: 600000,
        telemetry: 900000,
        tv: 2000
    };

    const pollers = [];

    function shouldPoll() {
        return !document.hidden;
    }

    function startPoller(task, intervalMs) {
        let inFlight = false;

        async function run(force = false) {
            if (!force && !shouldPoll()) return;
            if (inFlight) return;

            inFlight = true;
            try {
                await task();
            } catch (error) {
                console.error("Falha na atualização periódica:", error);
            } finally {
                inFlight = false;
            }
        }

        run(true);
        pollers.push(run);
        return window.setInterval(run, intervalMs);
    }

    async function fetchNavbarInfo() {

        const response = await fetch("/cgi-bin/get-info-navbar");
        const res = await response.json();

        if (res.status == "Success") {
            document.getElementById("location-config-nav").textContent = res.data.location || "--";
            document.getElementById("client-config-nav").textContent = res.data.client || "--";
            document.getElementById("wan-ip-config-nav").textContent = res.data.wanIp || "--";
            document.getElementById("lan-ip-config-nav").textContent = res.data.lanIp || "--";
            document.getElementById("id-config-nav").textContent = res.data.deviceId || "--";
            document.getElementById("version-config-nav").textContent = res.data.version || "--";
        } else {
            window.alert("Erro: " + res.msg);
        }

    }

    async function fetchUptime() {

        const response = await fetch("/cgi-bin/get-uptime");
        const res = await response.json();

        if (res.status == "Success") {
            var uptimeElement = document.getElementById("uptime");
            var dias = res.data.dias;
            var horas = res.data.horas;
            var minutos = res.data.minutos;
            uptimeElement.textContent = `${dias}d ${horas}h ${minutos}m`;
        } else {
            window.alert("Erro: " + res.msg);
        }
    }

    async function fetchTraffic() {

        const response = await fetch("/cgi-bin/get-traffic");
        const res = await response.json();

        if (res.status == "Success") {
            document.getElementById("rx-traffic").textContent = res.data.rx_mb + " MB";
            document.getElementById("tx-traffic").textContent = res.data.tx_mb + " MB";
        } else {
            window.alert("Erro: " + res.msg);
        }
    }

    async function fetchCpuTemperature() {
        const response = await fetch("/cgi-bin/get-temp-cpu");
        const res = await response.json();

        const tempElement = document.getElementById("cpu-temp");
        const statusElement = document.getElementById("cpu-temp-status");

        if (res.status == "Success") {
            const tempCelsius = Number(res.data.celsius);
            tempElement.textContent = Number.isFinite(tempCelsius) ? `${tempCelsius.toFixed(1)} °C` : "--";

            if (Number.isFinite(tempCelsius)) {
                if (tempCelsius >= 80) {
                    statusElement.textContent = "HIGH";
                    statusElement.className = "text-danger font-mono";
                } else if (tempCelsius >= 65) {
                    statusElement.textContent = "WARM";
                    statusElement.className = "text-warning font-mono";
                } else {
                    statusElement.textContent = "NORMAL";
                    statusElement.className = "text-success font-mono";
                }
            } else {
                statusElement.textContent = "--";
                statusElement.className = "text-warning font-mono";
            }
        } else {
            tempElement.textContent = "--";
            statusElement.textContent = "ERROR";
            statusElement.className = "text-danger font-mono";
        }
    }

    async function fetchLogs() {
        const response = await fetch("/cgi-bin/get-log-watchdog?limit=30");
        const res = await response.json();

        if (res.status == "Success") {
            const logsBody = document.getElementById("logs-body");
            const logsSummary = document.getElementById("logs-summary");
            logsBody.innerHTML = "";

            const groupedLogs = [];
            (res.logs || []).forEach(logLine => {
                const parts = logLine.split(" - ");
                const timestamp = parts[0] || "--";
                const message = parts[1] || logLine;
                const last = groupedLogs[groupedLogs.length - 1];

                if (last && last.message === message) {
                    last.count += 1;
                    last.timestamp = timestamp;
                } else {
                    groupedLogs.push({ timestamp, message, count: 1 });
                }
            });

            if (logsSummary) {
                logsSummary.textContent = `${res.shown || 0}/${res.total || 0} linhas`;
            }

            if (groupedLogs.length === 0) {
                logsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Nenhum log disponível.</td></tr>`;
                return;
            }

            groupedLogs.slice(-20).forEach(log => {
                const countBadge = log.count > 1
                    ? `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 ms-2">x${log.count}</span>`
                    : "";

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="font-mono small">${log.timestamp}</td>
                    <td><span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 small">INFO</span></td>
                    <td class="text-muted small">WATCHDOG</td>
                    <td class="text-light small">${log.message}${countBadge}</td>
                `;
                logsBody.appendChild(tr);
            });
        } else {
            window.alert("Erro: " + res.msg);

        }
    }

    async function fetchTelemetry() {
        try {
            const response = await fetch("/public/telemetry_data.json", { cache: "no-cache" });
            if (!response.ok) throw new Error("Erro na requisição");
            
            const data = await response.json();
            const container = document.getElementById("telemetry-container");
            
            if (!data.equipamentos) {
                container.innerHTML = `<div class="col-12 text-center text-muted">Nenhum dado de telemetria disponível.</div>`;
                return;
            }

            let html = "";
            data.equipamentos.forEach(eq => {
                let sensorsHtml = "";
                
                if (eq.OIDS && eq.OIDS.length > 0) {
                    eq.OIDS.forEach(oid => {
                        let valueDisplay = "--";
                        let statusClass = "text-light";

                        if (oid.last_error) {
                            valueDisplay = `<span class="text-danger" title="Erro de leitura"><i class="bi bi-exclamation-triangle"></i></span>`;
                        } else if (oid.last_value !== undefined) {
                            // Se tiver status (enum), prioriza exibir ele se for string
                            if (oid.last_status) {
                                valueDisplay = oid.last_status;
                                const valLower = String(valueDisplay).toLowerCase();
                                if (valLower === "ok" || valLower === "locked" || valLower === "active") statusClass = "text-success";
                                else if (valLower.includes("warning")) statusClass = "text-warning";
                                else if (valLower.includes("error") || valLower.includes("alarm") || valLower.includes("fail")) statusClass = "text-danger";
                            } else {
                                valueDisplay = oid.last_value;

                                // Aplica mascara de 0.001 para potencia direta
                                const oidName = (oid.nome || oid.topico || "").toLowerCase();
                                if (oidName.includes("potencia direta") || oidName.includes("potência direta")) {
                                    if (typeof valueDisplay === 'number') {
                                        valueDisplay = valueDisplay * 0.001;
                                    }
                                }

                                // Se for número e tiver máscara decimal, talvez formatar? Por enquanto deixa raw.
                                if (typeof valueDisplay === 'number' && !Number.isInteger(valueDisplay)) {
                                    valueDisplay = valueDisplay.toFixed(2);
                                }
                            }

                            if (oid.unidade) {
                                valueDisplay += ` <small class="text-muted ml-1">${oid.unidade}</small>`;
                            }
                        }

                        sensorsHtml += `
                            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-10 py-2">
                                <span class="text-secondary small text-uppercase" style="font-size: 0.75rem">${oid.nome || oid.topico}</span>
                                <span class="font-mono fw-bold ${statusClass} small">${valueDisplay}</span>
                            </div>
                        `;
                    });
                }

                html += `
                    <div class="col-md-6 col-xl-4">
                        <div class="dash-card h-100">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h6 class="text-white mb-0 text-uppercase">${eq.modelo || "Equipamento"}</h6>
                                    <small class="text-muted font-mono" style="font-size: 0.70rem">SN: ${eq.numero_de_serie || "--"}</small>
                                </div>
                                <div class="p-2 bg-dark border border-secondary border-opacity-25 rounded-2">
                                     <i class="bi bi-hdd-network text-secondary"></i>
                                </div>
                            </div>
                            <div class="mt-2 text-white">
                                ${sensorsHtml}
                            </div>
                            <div class="mt-3 text-end pt-2 border-top border-secondary border-opacity-10">
                                <small class="text-muted fst-italic" style="font-size: 0.65rem">
                                    <i class="bi bi-geo-alt me-1"></i>${eq.site_id} &bull; ${eq.ip}
                                </small>
                            </div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;

        } catch (error) {
            console.error("Erro ao buscar telemetria:", error);
        }
    }

    const tvPlayerState = {
        hls: null,
        manifest: "",
        manifestWaitTimer: null,
        attachGeneration: 0,
        manifestAttached: false,
        channels: [],
        selectedChannel: "",
        regions: [],
        selectedRegion: ""
    };

    function tvElement(id) {
        return document.getElementById(id);
    }

    function setTvError(message) {
        const element = tvElement("tv-error");
        if (!element) return;
        element.textContent = message || "";
        element.hidden = !message;
    }

    function setTvBadge(text, tone = "secondary") {
        const element = tvElement("tv-status-badge");
        if (!element) return;
        element.textContent = text;
        element.className = `badge bg-dark border border-${tone} text-${tone} font-mono`;
    }

    function formatTvFrequency(frequency) {
        const value = Number(frequency);
        if (!Number.isFinite(value) || value <= 0) return frequency || "--";
        return `${(value / 1000000).toFixed(3)} MHz`;
    }

    function formatTvBandwidth(bandwidth) {
        const value = Number(bandwidth);
        if (!Number.isFinite(value) || value <= 0) return bandwidth || "--";
        return `${(value / 1000000).toFixed(3)} MHz`;
    }

    function updateTvMetadata(channel) {
        const container = tvElement("tv-channel-metadata");
        if (!container) return;

        const fields = {
            "tv-meta-service-id": channel?.service_id || "--",
            "tv-meta-frequency": formatTvFrequency(channel?.frequency),
            "tv-meta-video-pid": channel?.video_pid || "--",
            "tv-meta-audio-pid": channel?.audio_pid || "--",
            "tv-meta-video-codec": channel?.video_codec || "H.264",
            "tv-meta-audio-codec": channel?.audio_codec || "AAC",
            "tv-meta-modulation": channel?.modulation || "--",
            "tv-meta-bandwidth": formatTvBandwidth(channel?.bandwidth_hz),
            "tv-meta-guard-mode": [channel?.guard_interval, channel?.transmission_mode]
                .filter(Boolean).join(" / ") || "--",
            "tv-meta-code-rate": [channel?.code_rate_hp, channel?.code_rate_lp]
                .filter(Boolean).join(" / ") || "--",
            "tv-meta-inversion": channel?.inversion || "--"
        };
        Object.entries(fields).forEach(([id, value]) => {
            const element = tvElement(id);
            if (element) element.textContent = value;
        });
        container.hidden = !channel;
    }

    function destroyTvPlayer(clearSource = true) {
        const video = tvElement("tv-video");
        tvPlayerState.attachGeneration += 1;
        if (tvPlayerState.manifestWaitTimer) {
            clearTimeout(tvPlayerState.manifestWaitTimer);
            tvPlayerState.manifestWaitTimer = null;
        }
        if (tvPlayerState.hls) {
            tvPlayerState.hls.destroy();
            tvPlayerState.hls = null;
        }
        if (video && clearSource) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
        tvPlayerState.manifest = "";
        tvPlayerState.manifestAttached = false;
        const placeholder = tvElement("tv-video-placeholder");
        if (placeholder) placeholder.hidden = false;
    }

    function attachTvManifest(manifest, requireEndList = false) {
        const video = tvElement("tv-video");
        const placeholder = tvElement("tv-video-placeholder");
        if (!video || !manifest || tvPlayerState.manifest === manifest) return;

        destroyTvPlayer(false);
        tvPlayerState.manifest = manifest;
        tvPlayerState.manifestAttached = false;
        const generation = tvPlayerState.attachGeneration;
        const source = () => `${manifest}?v=${Date.now()}`;

        const tryPlay = () => {
            if (placeholder) placeholder.hidden = true;
            video.play().catch(() => {
                setTvError("Clique no player para iniciar o áudio/vídeo.");
            });
        };

        const attachReadyManifest = () => {
            if (generation !== tvPlayerState.attachGeneration ||
                tvPlayerState.manifest !== manifest) return;

            tvPlayerState.manifestWaitTimer = null;
            tvPlayerState.manifestAttached = true;
            video.muted = false;
            video.addEventListener("canplay", tryPlay, { once: true });

            if (window.Hls && window.Hls.isSupported()) {
                const hls = new window.Hls({
                    enableWorker: true,
                    liveSyncDurationCount: 3
                });
                tvPlayerState.hls = hls;
                hls.on(window.Hls.Events.ERROR, (_event, data) => {
                    if (!data || !data.fatal ||
                        generation !== tvPlayerState.attachGeneration) return;

                    destroyTvPlayer(false);
                    setTvError("Aguardando dados válidos da transmissão...");
                    tvPlayerState.manifest = "";
                    tvPlayerState.manifestWaitTimer = setTimeout(() => {
                        attachTvManifest(manifest, requireEndList);
                    }, 1500);
                });
                hls.loadSource(source());
                hls.attachMedia(video);
                return;
            }

            if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = source();
                return;
            }

            setTvError("Este navegador não possui suporte a HLS.");
        };

        const waitForPlaylist = async (attempt = 0) => {
            if (generation !== tvPlayerState.attachGeneration ||
                tvPlayerState.manifest !== manifest) return;

            try {
                const response = await fetch(source(), { cache: "no-store" });
                const playlist = await response.text();
                const ready = response.ok && playlist.includes("#EXTM3U") &&
                    playlist.includes("#EXTINF") &&
                    (!requireEndList || playlist.includes("#EXT-X-ENDLIST"));
                if (ready) {
                    attachReadyManifest();
                    return;
                }
            } catch (_error) {
                // The capture may still be creating the first playlist.
            }

            if (attempt >= 20) {
                setTvError("A transmissão não gerou uma playlist HLS válida.");
                return;
            }

            tvPlayerState.manifestWaitTimer = setTimeout(() => {
                waitForPlaylist(attempt + 1);
            }, 1000);
        };

        setTvError("Aguardando o início da transmissão...");
        waitForPlaylist();
    }

    function updateTvChannelSelect(channels, selectedChannel) {
        const select = tvElement("tv-channel-select");
        if (!select) return;

        const previous = selectedChannel || select.value;
        select.innerHTML = "";
        if (!channels.length) {
            select.disabled = true;
            select.appendChild(new Option("Nenhum canal carregado", ""));
            return;
        }

        select.disabled = false;
        channels.forEach(channel => {
            const label = channel.frequency
                ? `${channel.name} · ${formatTvFrequency(channel.frequency)}`
                : channel.name;
            select.appendChild(new Option(label, channel.id));
        });

        if (channels.some(channel => channel.id === previous)) {
            select.value = previous;
        } else {
            select.selectedIndex = 0;
        }
        tvPlayerState.selectedChannel = select.value;
        updateTvMetadata(channels.find(channel => channel.id === select.value));
    }

    function updateTvRegionSelect(regions, selectedRegion) {
        const select = tvElement("tv-region-select");
        if (!select) return;

        const previous = selectedRegion || select.value;
        select.innerHTML = "";
        if (!regions.length) {
            select.disabled = true;
            select.appendChild(new Option("Nenhuma tabela regional encontrada", ""));
            return;
        }

        select.disabled = false;
        regions.forEach(region => {
            select.appendChild(new Option(region.label, region.id));
        });
        if (regions.some(region => region.id === previous)) {
            select.value = previous;
        } else {
            select.selectedIndex = 0;
        }
        tvPlayerState.selectedRegion = select.value;
    }

    async function fetchTvRegions() {
        try {
            const response = await fetch("/cgi-bin/tv-regions", { cache: "no-cache" });
            const result = await response.json();
            if (result.status !== "Success") throw new Error(result.msg || "Falha ao carregar regiões");
            tvPlayerState.regions = Array.isArray(result.data?.regions) ? result.data.regions : [];
            tvPlayerState.selectedRegion = result.data?.selected_region_id || tvPlayerState.selectedRegion;
            updateTvRegionSelect(tvPlayerState.regions, tvPlayerState.selectedRegion);
        } catch (error) {
            console.error("Erro ao buscar tabelas regionais de TV:", error);
            const select = tvElement("tv-region-select");
            if (select) {
                select.disabled = true;
                select.innerHTML = "";
                select.appendChild(new Option("Falha ao carregar tabelas", ""));
            }
        }
    }

    async function fetchTvChannels() {
        try {
            const response = await fetch("/cgi-bin/tv-channels", { cache: "no-cache" });
            const result = await response.json();
            if (result.status !== "Success") throw new Error(result.msg || "Falha ao carregar canais");
            tvPlayerState.channels = Array.isArray(result.data?.channels) ? result.data.channels : [];
            updateTvChannelSelect(tvPlayerState.channels, tvPlayerState.selectedChannel);
            const count = tvElement("tv-channel-count");
            if (count) count.textContent = tvPlayerState.channels.length;
        } catch (error) {
            console.error("Erro ao buscar canais de TV:", error);
            setTvError("Não foi possível carregar a lista de canais.");
        }
    }

    function updateTvControls(data) {
        const scanRunning = data.scan_state === "running";
        const streamRunning = data.stream_state === "running";
        const sampleCapturing = data.stream_state === "capturing";
        const sampleReady = data.stream_state === "ready";
        const streamPresent = streamRunning || sampleCapturing || sampleReady;
        const scanButton = tvElement("tv-scan-btn");
        const startButton = tvElement("tv-start-btn");
        const stopButton = tvElement("tv-stop-btn");
        const regionSelect = tvElement("tv-region-select");
        const select = tvElement("tv-channel-select");
        const regionState = tvElement("tv-region-state");
        const scanState = tvElement("tv-scan-state");
        const streamState = tvElement("tv-stream-state");
        const statusText = tvElement("tv-status-text");
        const tuner = tvElement("tv-tuner-indicator");

        if (scanButton) scanButton.disabled = scanRunning || !regionSelect || !regionSelect.value;
        if (startButton) startButton.disabled = scanRunning || sampleCapturing || !select || !select.value;
        if (stopButton) stopButton.disabled = !streamPresent && data.stream_state !== "error";
        if (regionSelect) regionSelect.disabled = scanRunning || tvPlayerState.regions.length === 0;
        if (select) select.disabled = scanRunning || sampleCapturing || tvPlayerState.channels.length === 0;
        if (regionState) regionState.textContent = data.region_name || data.region_id || "--";
        if (scanState) scanState.textContent = data.scan_state || "--";
        if (streamState) streamState.textContent = data.stream_state || "--";
        if (statusText) {
            statusText.textContent = data.error || (sampleCapturing
                ? `Gerando amostra ${data.sample_width || 640}x${data.sample_height || 360} (${data.sample_seconds || 15}s)`
                : sampleReady ? `Amostra pronta: ${data.channel_name || "canal selecionado"}`
                : streamRunning
                ? `Transmitindo ${data.channel_name || "canal selecionado"}`
                : scanRunning ? `Varredura em andamento${data.region_name ? ` · ${data.region_name}` : ""}` : "Pronto para iniciar");
        }
        if (tuner) {
            tuner.textContent = data.tuner_present ? "TUNER OK" : "TUNER AUSENTE";
            tuner.classList.toggle("is-ready", Boolean(data.tuner_present));
        }

        if (data.enabled === false) {
            if (scanButton) scanButton.disabled = true;
            if (startButton) startButton.disabled = true;
            if (stopButton) stopButton.disabled = true;
            if (regionSelect) regionSelect.disabled = true;
            if (select) select.disabled = true;
            if (statusText) statusText.textContent = "TV digital desativada na configuração";
            setTvBadge("DESATIVADA", "secondary");
            destroyTvPlayer();
            return;
        }

        if (data.stream_state === "capturing" && data.manifest) {
            if (tvPlayerState.hls || tvPlayerState.manifest || tvPlayerState.manifestWaitTimer) {
                destroyTvPlayer();
            }
            setTvBadge("GERANDO AMOSTRA", "warning");
            setTvError(`Capturando ${data.sample_seconds || 15} segundos de vídeo...`);
        } else if (data.stream_state === "ready" && data.manifest) {
            attachTvManifest(data.manifest, true);
            setTvBadge("AMOSTRA PRONTA", "success");
            if (tvPlayerState.manifestAttached) setTvError("");
        } else if (data.stream_state === "running" && data.manifest) {
            attachTvManifest(data.manifest);
            setTvBadge("TRANSMITINDO", "success");
            setTvError("");
        } else if (data.scan_state === "running") {
            setTvBadge("VARREDURA", "warning");
        } else if (data.error) {
            setTvBadge("ERRO", "danger");
            setTvError(data.error);
            destroyTvPlayer();
        } else if (!data.tuner_present) {
            setTvBadge("TUNER AUSENTE", "danger");
            destroyTvPlayer();
        } else {
            setTvBadge("PRONTA", "secondary");
            if (!streamPresent) destroyTvPlayer();
        }
    }

    async function fetchTvStatus() {
        try {
            const response = await fetch("/cgi-bin/tv-status", { cache: "no-cache" });
            const result = await response.json();
            if (result.status !== "Success") throw new Error(result.msg || "Falha no status da TV");
            updateTvControls(result.data || {});
            if (Number(result.data?.channel_count) !== tvPlayerState.channels.length) {
                await fetchTvChannels();
            }
            const selected = result.data?.channel_id;
            if (selected && tvPlayerState.channels.length) {
                updateTvChannelSelect(tvPlayerState.channels, selected);
            }
            if (result.data?.region_id && tvPlayerState.regions.length) {
                updateTvRegionSelect(tvPlayerState.regions, result.data.region_id);
            }
        } catch (error) {
            console.error("Erro ao buscar status da TV:", error);
            setTvBadge("SEM RESPOSTA", "danger");
            const statusText = tvElement("tv-status-text");
            if (statusText) statusText.textContent = "Controlador indisponível";
        }
    }

    async function tvPost(url) {
        const response = await fetch(url, { method: "POST" });
        const result = await response.json();
        if (result.status !== "Success") throw new Error(result.msg || "Operação de TV falhou");
        return result;
    }

    async function requestTvScan() {
        const regionSelect = tvElement("tv-region-select");
        if (!regionSelect || !regionSelect.value) {
            setTvError("Nenhuma tabela regional disponível para a varredura.");
            return;
        }
        try {
            setTvError("");
            tvPlayerState.selectedRegion = regionSelect.value;
            await tvPost(`/cgi-bin/tv-scan?region_id=${encodeURIComponent(regionSelect.value)}`);
            await fetchTvStatus();
        } catch (error) {
            setTvError(error.message);
        }
    }

    async function requestTvStart() {
        const select = tvElement("tv-channel-select");
        if (!select || !select.value) return;
        try {
            setTvError("");
            tvPlayerState.selectedChannel = select.value;
            await tvPost(`/cgi-bin/tv-select?channel_id=${encodeURIComponent(select.value)}`);
            await fetchTvStatus();
        } catch (error) {
            setTvError(error.message);
        }
    }

    async function requestTvStop() {
        try {
            await tvPost("/cgi-bin/tv-stop");
            destroyTvPlayer();
            await fetchTvStatus();
        } catch (error) {
            setTvError(error.message);
        }
    }

    function initializeTvControls() {
        const scanButton = tvElement("tv-scan-btn");
        const startButton = tvElement("tv-start-btn");
        const stopButton = tvElement("tv-stop-btn");
        const regionSelect = tvElement("tv-region-select");
        const select = tvElement("tv-channel-select");
        if (scanButton) scanButton.addEventListener("click", requestTvScan);
        if (startButton) startButton.addEventListener("click", requestTvStart);
        if (stopButton) stopButton.addEventListener("click", requestTvStop);
        if (regionSelect) {
            regionSelect.addEventListener("change", () => {
                tvPlayerState.selectedRegion = regionSelect.value;
            });
        }
        if (select) {
            select.addEventListener("change", () => {
                tvPlayerState.selectedChannel = select.value;
                updateTvMetadata(tvPlayerState.channels.find(channel => channel.id === select.value));
            });
        }
        fetchTvRegions();
        fetchTvChannels();
    }

    const batteryPowerState = {
        vinPresent: null,
        upsEnabled: null
    };

    function updateBatteryOperation() {
        const cardElement = document.querySelector(".battery-card");
        const operationElement = document.getElementById("battery-operation");
        const textElement = document.getElementById("battery-operation-text");

        if (!cardElement || !operationElement || !textElement) return;

        cardElement.classList.remove("is-charging", "is-using", "is-disabled");
        operationElement.classList.remove("is-charging", "is-using", "is-disabled");

        if (batteryPowerState.upsEnabled === null || batteryPowerState.vinPresent === null) {
            textElement.textContent = "AGUARDANDO ENERGIA";
            return;
        }

        if (!batteryPowerState.upsEnabled) {
            cardElement.classList.add("is-disabled");
            operationElement.classList.add("is-disabled");
            textElement.textContent = "UPS DESATIVADO";
            return;
        }

        if (batteryPowerState.vinPresent) {
            cardElement.classList.add("is-charging");
            operationElement.classList.add("is-charging");
            textElement.textContent = "BATERIA CARREGANDO";
            return;
        }

        cardElement.classList.add("is-using");
        operationElement.classList.add("is-using");
        textElement.textContent = "BATERIA EM USO";
    }

    function setBatteryUnavailable() {
        const percentElement = document.getElementById("battery-percent");
        const voltageElement = document.getElementById("battery-voltage");
        const statusElement = document.getElementById("battery-status");
        const levelElement = document.getElementById("battery-level");
        const adcElement = document.getElementById("battery-adc");

        if (percentElement) percentElement.textContent = "--%";
        if (voltageElement) voltageElement.textContent = "-- V";
        if (statusElement) {
            statusElement.textContent = "INDISPONÍVEL";
            statusElement.className = "text-danger font-mono";
        }
        if (adcElement) adcElement.textContent = "AIN3 · erro";
        if (levelElement) {
            levelElement.style.width = "0%";
            levelElement.className = "battery-level";
        }
    }

    function updateBatteryGauge(channel) {
        const voltage = Number(channel.voltage);
        const minVoltage = Number(channel.battery_min_voltage ?? 3.5);
        const maxVoltage = Number(channel.battery_max_voltage ?? 4.35);
        const reportedPercent = Number(channel.battery_percent);
        const calculatedPercent = ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
        const percent = Math.round(Math.max(0, Math.min(100,
            Number.isFinite(reportedPercent) ? reportedPercent : calculatedPercent)));
        const percentElement = document.getElementById("battery-percent");
        const voltageElement = document.getElementById("battery-voltage");
        const statusElement = document.getElementById("battery-status");
        const levelElement = document.getElementById("battery-level");
        const adcElement = document.getElementById("battery-adc");
        const iconElement = document.getElementById("battery-icon");

        if (!Number.isFinite(voltage)) {
            setBatteryUnavailable();
            return;
        }

        let label = "NORMAL";
        let tone = "success";
        let levelClass = "is-good";
        let iconClass = "bi-battery-half";

        if (percent <= 15) {
            label = "CRÍTICA";
            tone = "danger";
            levelClass = "is-critical";
            iconClass = "bi-battery";
        } else if (percent <= 35) {
            label = "BAIXA";
            tone = "warning";
            levelClass = "is-low";
            iconClass = "bi-battery-half";
        } else if (percent >= 95) {
            label = "CARREGADA";
            iconClass = "bi-battery-full";
        }

        if (percentElement) percentElement.textContent = `${percent}%`;
        if (voltageElement) voltageElement.textContent = `${voltage.toFixed(3)} V`;
        if (statusElement) {
            statusElement.textContent = label;
            statusElement.className = `text-${tone} font-mono`;
        }
        if (adcElement) adcElement.textContent = `AIN3 · raw ${channel.raw}`;
        if (levelElement) {
            levelElement.style.width = `${percent}%`;
            levelElement.className = `battery-level ${levelClass}`;
        }
        if (iconElement) {
            iconElement.className = `bi ${iconClass} text-${tone}`;
        }
    }

    async function fetchAds1015() {
        try {
            const response = await fetch("/cgi-bin/get-ads1015");
            const res = await response.json();

            if (res.status == "Success" && res.data.channels) {
                res.data.channels.forEach(channel => {
                    const ch = channel.channel;
                    const voltage = parseFloat(channel.voltage);
                    const adsVoltage = parseFloat(channel.ads_voltage);
                    const raw = channel.raw;
                    const kernelScale = channel.kernel_scale;
                    const voltageElement = document.getElementById(`ads-ch${ch}-voltage`);
                    const rawElement = document.getElementById(`ads-ch${ch}-raw`);
                    const statusElement = document.getElementById(`ads-ch${ch}-status`);

                    if (ch === 3 || channel.role === "battery") {
                        updateBatteryGauge(channel);
                        if (statusElement) {
                            statusElement.textContent = `ADC OK · ${adsVoltage.toFixed(3)} V`;
                            statusElement.className = "text-success font-mono d-block mt-2";
                        }
                        return;
                    }

                    if (voltageElement && rawElement && statusElement) {
                        voltageElement.textContent = `Entrada: ${voltage.toFixed(3)} V`;
                        rawElement.textContent = `ADS: ${adsVoltage.toFixed(3)} V | raw: ${raw} | k: ${kernelScale}`;
                        statusElement.textContent = "OK";
                        statusElement.className = "text-success font-mono";
                    }
                });
            } else {
                // ADS1015 não disponível, mostrar erro em todos os canais
                for (let i = 0; i < 4; i++) {
                    const statusElement = document.getElementById(`ads-ch${i}-status`);
                    if (statusElement) {
                        statusElement.textContent = "ERRO";
                        statusElement.className = "text-danger font-mono";
                    }
                }
                setBatteryUnavailable();
            }
        } catch (error) {
            console.error("Erro ao buscar ADS1015:", error);
            for (let i = 0; i < 4; i++) {
                const statusElement = document.getElementById(`ads-ch${i}-status`);
                if (statusElement) {
                    statusElement.textContent = "ERRO";
                    statusElement.className = "text-danger font-mono";
                }
            }
            setBatteryUnavailable();
        }
    }

    async function fetchVinStatus() {
        try {
            const response = await fetch("/cgi-bin/get-vin-status");
            const res = await response.json();
            const statusElement = document.getElementById("vin-status");
            const rawElement = document.getElementById("vin-raw");

            if (!statusElement || !rawElement) return;

            if (res.status === "Success") {
                const present = Boolean(res.data.vin_present);
                batteryPowerState.vinPresent = present;
                updateBatteryOperation();
                statusElement.textContent = present ? "NORMAL" : "BATERIA";
                statusElement.className = present
                    ? "card-value mt-1 mb-0 text-success"
                    : "card-value mt-1 mb-0 text-danger";
                rawElement.textContent = String(res.data.raw ?? "--");
            } else {
                batteryPowerState.vinPresent = null;
                updateBatteryOperation();
                statusElement.textContent = "ERRO";
                statusElement.className = "card-value mt-1 mb-0 text-warning";
                rawElement.textContent = "--";
            }
        } catch (error) {
            console.error("Erro ao buscar VIN:", error);
            batteryPowerState.vinPresent = null;
            updateBatteryOperation();
        }
    }

    async function fetchStatusVpn() {
        var connectionBagdeElement = document.getElementById("connection-badge");
        var connectionDotElement = document.getElementById("connection-dot");
        var connectionTextElement = document.getElementById("connection-text");

        if (!connectionBagdeElement || !connectionDotElement || !connectionTextElement) {
            return;
        }

        const response = await fetch("/cgi-bin/get-status-vpn");
        const res = await response.json();

        if (res.status == "Success") {

            connectionBagdeElement.classList.replace('bg-danger', 'bg-success');
            connectionBagdeElement.classList.replace('text-danger', 'text-success');
            connectionBagdeElement.classList.replace('border-danger', 'border-success');

            connectionDotElement.classList.replace('status-offline', 'status-online');
            
            connectionTextElement.textContent = "ONLINE";
        } else {

            connectionBagdeElement.classList.replace('bg-success', 'bg-danger');
            connectionBagdeElement.classList.replace('text-success', 'text-danger');
            connectionBagdeElement.classList.replace('border-success', 'border-danger');

            connectionDotElement.classList.replace('status-online', 'status-offline');

            connectionTextElement.textContent = "OFFLINE";
        }
    }

    async function fetchRssi() {
        try {
            const response = await fetch("/cgi-bin/get-rssi");
            const res = await response.json();

            const rssiElement = document.getElementById("modem-rssi");
            const statusElement = document.getElementById("modem-rssi-status");

            if (res.status == "Success") {
                const rssi = res.data.rssi;
                rssiElement.textContent = rssi;

                if (rssi >= 20 && rssi <= 31) {
                    statusElement.textContent = "EXCELENTE";
                    statusElement.className = "text-success font-mono";
                } else if (rssi >= 15 && rssi < 20) {
                    statusElement.textContent = "BOM";
                    statusElement.className = "text-info font-mono";
                } else if (rssi >= 10 && rssi < 15) {
                    statusElement.textContent = "REGULAR";
                    statusElement.className = "text-warning font-mono";
                } else if (rssi > 0 && rssi < 10) {
                    statusElement.textContent = "FRACO";
                    statusElement.className = "text-danger font-mono";
                } else if (rssi == 99) {
                    statusElement.textContent = "SEM SINAL";
                    statusElement.className = "text-danger font-mono";
                    rssiElement.textContent = "--";
                } else {
                    statusElement.textContent = "DESCONHECIDO";
                    statusElement.className = "text-muted font-mono";
                }
            } else {
                rssiElement.textContent = "--";
                statusElement.textContent = "ERRO";
                statusElement.className = "text-danger font-mono";
            }
        } catch (error) {
            console.error("Erro ao buscar RSSI:", error);
            document.getElementById("modem-rssi").textContent = "--";
            document.getElementById("modem-rssi-status").textContent = "ERRO";
            document.getElementById("modem-rssi-status").className = "text-danger font-mono";
        }
    }

    window.fetchLogs = fetchLogs;

    // Relay Control Functions
    function updateRelayControls(data) {
        const relay1Toggle = document.getElementById("relay1-toggle");
        const relay2Toggle = document.getElementById("relay2-toggle");
        const upsState = document.getElementById("ups-relay-state");
        const relay2State = document.getElementById("relay2-state");
        const upsEnabled = Boolean(data.ups_enabled ?? data.relay1);
        const relay2Enabled = Boolean(data.relay2);

        if (relay1Toggle) relay1Toggle.checked = upsEnabled;
        if (relay2Toggle) relay2Toggle.checked = relay2Enabled;
        if (upsState) {
            upsState.textContent = `Relé 1 · ${upsEnabled ? "ATIVO" : "DESATIVADO"}`;
            upsState.className = `${upsEnabled ? "text-success" : "text-muted"} font-mono`;
        }
        if (relay2State) {
            relay2State.textContent = `Relé 2 · ${relay2Enabled ? "ATIVO" : "DESATIVADO"}`;
            relay2State.className = `${relay2Enabled ? "text-success" : "text-muted"} font-mono`;
        }

        batteryPowerState.upsEnabled = upsEnabled;
        updateBatteryOperation();
    }

    async function fetchRelays() {
        try {
            const response = await fetch("/cgi-bin/relay-control");
            const res = await response.json();

            if (res.status == "Success") {
                updateRelayControls(res.data);
            } else {
                console.error("Erro ao buscar estado dos relés:", res.msg);
            }
        } catch (error) {
            console.error("Erro na requisição de relés:", error);
        }
    }

    async function setRelay(relay, state) {
        const toggle = document.getElementById(`relay${relay}-toggle`);
        const stateElement = document.getElementById(relay == 1 ? "ups-relay-state" : "relay2-state");

        if (toggle) toggle.disabled = true;

        try {
            const response = await fetch(`/cgi-bin/relay-control?relay=${relay}&state=${state ? 1 : 0}`, {
                method: "POST"
            });
            const res = await response.json();

            if (res.status == "Success") {
                updateRelayControls(res.data);
            } else {
                throw new Error(res.msg || "Falha ao aplicar estado");
            }
        } catch (error) {
            console.error("Erro na requisição de alteração de relé:", error);
            if (stateElement) {
                stateElement.textContent = "ERRO AO ACIONAR";
                stateElement.className = "text-danger font-mono";
            }
            if (toggle) toggle.checked = !state;
            window.setTimeout(fetchRelays, 1500);
        } finally {
            if (toggle) toggle.disabled = false;
        }
    }

    // Add event listeners for relay toggles
    const relayToggles = document.querySelectorAll(".relay-toggle");
    relayToggles.forEach(toggle => {
        toggle.addEventListener("change", function() {
            const relayNum = this.getAttribute("data-relay");
            setRelay(relayNum, this.checked);
        });
    });

    // ============ RELAY SCHEDULER FUNCTIONS ============
    
    let scheduleData = {
        schema_version: 1,
        enabled: true,
        timezone: "local",
        rules: []
    };
    let scheduleLoaded = false;

    const dayLabels = {
        mon: "Seg",
        tue: "Ter",
        wed: "Qua",
        thu: "Qui",
        fri: "Sex",
        sat: "Sab",
        sun: "Dom"
    };

    function normalizeScheduleData(data) {
        return {
            schema_version: Number(data?.schema_version) || 1,
            enabled: Boolean(data?.enabled),
            timezone: data?.timezone || "local",
            rules: Array.isArray(data?.rules) ? data.rules : []
        };
    }

    function setScheduleSaveStatus(text, tone = "secondary") {
        const element = document.getElementById("schedule-save-status");
        if (!element) return;

        element.textContent = text;
        element.className = `badge bg-dark border border-${tone} text-${tone} font-mono`;
    }

    function updateSchedulerHeader() {
        const enabledToggle = document.getElementById("scheduler-enabled");
        const badge = document.getElementById("scheduler-status-badge");
        const summary = document.getElementById("scheduler-summary");
        const enabled = Boolean(scheduleData.enabled);
        const totalRules = scheduleData.rules.length;
        const activeRules = scheduleData.rules.filter(rule => rule.enabled).length;

        if (enabledToggle) {
            enabledToggle.checked = enabled;
            enabledToggle.disabled = !scheduleLoaded;
        }

        if (badge) {
            badge.textContent = enabled ? "ON" : "OFF";
            badge.className = enabled
                ? "badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 font-mono"
                : "badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 font-mono";
        }

        if (summary) {
            summary.textContent = `${totalRules} regras configuradas | ${activeRules} ativas | timezone: ${scheduleData.timezone || "local"}`;
        }
    }

    function formatRuleDays(days) {
        if (!Array.isArray(days) || days.length === 0) {
            return "--";
        }

        return days.map(day => dayLabels[day] || day).join(", ");
    }

    function relayLabel(relay) {
        return Number(relay) === 1 ? "UPS (Relé 1)" : "Auxiliar (Relé 2)";
    }

    async function fetchScheduleConfig() {
        try {
            setScheduleSaveStatus("carregando", "secondary");
            const response = await fetch("/cgi-bin/relay-schedule");
            const res = await response.json();

            if (res.status == "Success" && res.data) {
                scheduleData = normalizeScheduleData(res.data);
                scheduleLoaded = true;
                renderScheduleRules();
                setScheduleSaveStatus("sincronizado", "success");
            } else {
                console.error("Error fetching schedule:", res.msg);
                scheduleLoaded = false;
                renderScheduleRules();
                setScheduleSaveStatus("erro", "danger");
            }
        } catch (error) {
            console.error("Error fetching schedule config:", error);
            scheduleLoaded = false;
            renderScheduleRules();
            setScheduleSaveStatus("erro", "danger");
        }
    }

    function renderScheduleRules() {
        const container = document.getElementById("schedule-rules-container");
        updateSchedulerHeader();

        if (!scheduleLoaded) {
            container.innerHTML = `
                <div class="scheduler-empty">
                    <i class="bi bi-calendar2-x text-secondary fs-4"></i>
                    <span>Agenda não carregada</span>
                </div>
            `;
            return;
        }

        if (!scheduleData.rules || scheduleData.rules.length === 0) {
            container.innerHTML = `
                <div class="scheduler-empty">
                    <i class="bi bi-calendar2-x text-secondary fs-4"></i>
                    <span>Nenhuma regra configurada</span>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-custom scheduler-table align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Regra</th>
                            <th>Relé</th>
                            <th>Ação</th>
                            <th>Horário</th>
                            <th>Dias</th>
                            <th>Status</th>
                            <th class="text-end">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        scheduleData.rules.forEach((rule, index) => {
            const daysStr = formatRuleDays(rule.days);
            const stateLabel = Number(rule.state) === 1 ? "Ligar" : "Desligar";
            const stateClass = Number(rule.state) === 1 ? "success" : "danger";
            const enabledClass = rule.enabled ? "success" : "secondary";
            const enabledText = rule.enabled ? "Ativa" : "Pausada";
            
            html += `
                        <tr>
                            <td>
                                <div class="font-mono text-light scheduler-rule-id">${rule.id || "--"}</div>
                            </td>
                            <td><span class="badge bg-dark border border-secondary text-secondary font-mono">${relayLabel(rule.relay)}</span></td>
                            <td><span class="badge bg-${stateClass} bg-opacity-10 text-${stateClass} border border-${stateClass} border-opacity-25">${stateLabel}</span></td>
                            <td class="font-mono text-light">${rule.time || "--"}</td>
                            <td class="text-muted">${daysStr}</td>
                            <td>
                                <div class="form-check form-switch scheduler-row-switch">
                                    <input class="form-check-input schedule-rule-toggle" type="checkbox"
                                        id="rule-enabled-${index}" data-index="${index}"
                                        ${rule.enabled ? "checked" : ""}>
                                    <label class="form-check-label small text-${enabledClass}" for="rule-enabled-${index}">
                                        ${enabledText}
                                    </label>
                                </div>
                            </td>
                            <td class="text-end scheduler-row-actions">
                                <button class="btn btn-sm btn-outline-warning" type="button"
                                    data-action="edit-rule" data-index="${index}" title="Editar">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" type="button"
                                    data-action="remove-rule" data-index="${index}" title="Remover">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;

        container.querySelectorAll(".schedule-rule-toggle").forEach(toggle => {
            toggle.addEventListener("change", () => toggleRuleEnabled(toggle));
        });

        container.querySelectorAll("[data-action='edit-rule']").forEach(button => {
            button.addEventListener("click", () => editScheduleRule(Number(button.dataset.index)));
        });

        container.querySelectorAll("[data-action='remove-rule']").forEach(button => {
            button.addEventListener("click", () => removeScheduleRule(Number(button.dataset.index)));
        });
    }

    function toggleRuleEnabled(checkbox) {
        const index = parseInt(checkbox.getAttribute("data-index"));
        if (scheduleData.rules[index]) {
            scheduleData.rules[index].enabled = checkbox.checked;
            saveScheduleConfig();
        }
    }

    window.toggleRuleEnabled = toggleRuleEnabled;

    function removeScheduleRule(index) {
        if (confirm("Deseja remover esta regra?")) {
            scheduleData.rules.splice(index, 1);
            saveScheduleConfig();
        }
    }

    window.removeScheduleRule = removeScheduleRule;

    function editScheduleRule(index) {
        const rule = scheduleData.rules[index];
        showScheduleRuleModal(rule, index);
    }

    window.editScheduleRule = editScheduleRule;

    function addScheduleRule() {
        if (!Array.isArray(scheduleData.rules)) {
            scheduleData.rules = [];
        }

        const newRule = {
            id: "rule_" + Date.now(),
            enabled: true,
            relay: 2,
            state: 1,
            time: "08:00",
            days: ["mon", "tue", "wed", "thu", "fri"]
        };
        showScheduleRuleModal(newRule, -1);
    }

    window.addScheduleRule = addScheduleRule;

    function showScheduleRuleModal(rule, index) {
        // Create a modal dialog for editing the rule
        const isNew = index === -1;
        const title = isNew ? "Adicionar Regra" : "Editar Regra";
        
        const daysOptions = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
            .map(day => {
                const checked = rule.days && rule.days.includes(day) ? "checked" : "";
                return `
                    <div class="form-check form-check-inline">
                        <input class="form-check-input day-checkbox" type="checkbox" value="${day}" 
                            id="day-${day}" ${checked}>
                        <label class="form-check-label" for="day-${day}">${dayLabels[day]}</label>
                    </div>
                `;
            }).join("");

        const modal = `
            <div class="modal is-open" id="ruleModal" role="dialog" aria-modal="true" aria-labelledby="ruleModalTitle">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark border border-secondary border-opacity-25">
                        <div class="modal-header border-secondary border-opacity-25">
                            <h5 class="modal-title" id="ruleModalTitle">${title}</h5>
                            <button type="button" class="btn-close" data-close-modal="ruleModal" aria-label="Fechar"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="ruleId" class="form-label text-light small text-uppercase">ID da Regra</label>
                                <input type="text" class="form-control bg-dark border-secondary text-light font-mono" 
                                    id="ruleId" value="${rule.id}" ${isNew ? '' : 'readonly'}>
                            </div>
                            
                            <div class="mb-3">
                                <label for="ruleRelay" class="form-label text-light small text-uppercase">Relé</label>
                                <select class="form-select bg-dark border-secondary text-light" id="ruleRelay">
                                    <option value="1" ${rule.relay == 1 ? 'selected' : ''}>UPS (Relé 1)</option>
                                    <option value="2" ${rule.relay == 2 ? 'selected' : ''}>Auxiliar (Relé 2)</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="ruleState" class="form-label text-light small text-uppercase">Estado</label>
                                <select class="form-select bg-dark border-secondary text-light" id="ruleState">
                                    <option value="1" ${rule.state == 1 ? 'selected' : ''}>Ligar (ON)</option>
                                    <option value="0" ${rule.state == 0 ? 'selected' : ''}>Desligar (OFF)</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="ruleTime" class="form-label text-light small text-uppercase">Horário (HH:MM)</label>
                                <input type="time" class="form-control bg-dark border-secondary text-light" 
                                    id="ruleTime" value="${rule.time}">
                            </div>

                            <div class="mb-3">
                                <label class="form-label text-light small text-uppercase d-block mb-2">Dias da Semana</label>
                                <div class="schedule-days-grid">
                                    ${daysOptions}
                                </div>
                            </div>

                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="ruleEnabled" 
                                    ${rule.enabled ? 'checked' : ''}>
                                <label class="form-check-label text-muted small" for="ruleEnabled">
                                    Regra ativa
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer border-secondary border-opacity-25">
                            <button type="button" class="btn btn-secondary" data-close-modal="ruleModal">Cancelar</button>
                            <button type="button" class="btn btn-jupiter" onclick="saveScheduleRule(${index})">Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const oldModal = document.getElementById("ruleModal");
        if (oldModal) {
            oldModal.remove();
        }

        document.body.insertAdjacentHTML("beforeend", modal);
        const modalElement = document.getElementById("ruleModal");
        modalElement.querySelectorAll("[data-close-modal]").forEach(button => {
            button.addEventListener("click", closeRuleModal);
        });
        modalElement.addEventListener("click", event => {
            if (event.target === modalElement) {
                closeRuleModal();
            }
        });
        document.getElementById("ruleId").focus();
    }

    function closeRuleModal() {
        const modal = document.getElementById("ruleModal");
        if (modal) {
            modal.remove();
        }
    }

    function saveScheduleRule(index) {
        // Get form values
        const id = document.getElementById("ruleId").value.trim();
        const relay = parseInt(document.getElementById("ruleRelay").value);
        const state = parseInt(document.getElementById("ruleState").value);
        const time = document.getElementById("ruleTime").value;
        const enabled = document.getElementById("ruleEnabled").checked;

        // Get selected days
        const days = Array.from(document.querySelectorAll(".day-checkbox:checked"))
            .map(cb => cb.value);

        // Validate
        if (!id || id.trim() === "") {
            alert("ID da regra é obrigatório");
            return;
        }

        if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            alert("Horário inválido (use HH:MM)");
            return;
        }

        if (days.length === 0) {
            alert("Selecione pelo menos um dia");
            return;
        }

        // Check for duplicate IDs (if new rule or if ID changed)
        const isNew = index === -1;
        const isDuplicateId = scheduleData.rules.some((r, i) => 
            r.id === id && (isNew || i !== index)
        );

        if (isDuplicateId) {
            alert("ID da regra já existe");
            return;
        }

        // Create or update rule
        const newRule = { id, enabled, relay, state, time, days };

        if (isNew) {
            scheduleData.rules.push(newRule);
        } else {
            scheduleData.rules[index] = newRule;
        }

        closeRuleModal();
        saveScheduleConfig();
    }

    window.saveScheduleRule = saveScheduleRule;

    function updateSchedulerState() {
        scheduleData.enabled = document.getElementById("scheduler-enabled").checked;
        saveScheduleConfig();
    }

    window.updateSchedulerState = updateSchedulerState;

    async function saveScheduleConfig() {
        try {
            scheduleData = normalizeScheduleData(scheduleData);
            scheduleLoaded = true;
            setScheduleSaveStatus("salvando", "warning");
            const response = await fetch("/cgi-bin/relay-schedule", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(scheduleData)
            });

            const res = await response.json();

            if (res.status == "Success") {
                console.log("Schedule config saved");
                renderScheduleRules();
                setScheduleSaveStatus("salvo", "success");
            } else {
                setScheduleSaveStatus("erro", "danger");
                alert("Erro ao salvar configuração: " + res.msg);
            }
        } catch (error) {
            console.error("Error saving schedule config:", error);
            setScheduleSaveStatus("erro", "danger");
            alert("Erro ao salvar configuração");
        }
    }

    async function ensureScheduleLoaded() {
        if (!scheduleLoaded) {
            await fetchScheduleConfig();
        }
        return scheduleLoaded;
    }

    const schedulerEnabled = document.getElementById("scheduler-enabled");
    const scheduleAddBtn = document.getElementById("schedule-add-btn");
    const scheduleRefreshBtn = document.getElementById("schedule-refresh-btn");

    if (schedulerEnabled) {
        schedulerEnabled.addEventListener("change", async () => {
            if (await ensureScheduleLoaded()) {
                updateSchedulerState();
            }
        });
    }
    if (scheduleAddBtn) {
        scheduleAddBtn.addEventListener("click", async () => {
            if (await ensureScheduleLoaded()) {
                addScheduleRule();
            }
        });
    }
    if (scheduleRefreshBtn) {
        scheduleRefreshBtn.addEventListener("click", fetchScheduleConfig);
    }

    renderScheduleRules();

    initializeTvControls();
    startPoller(fetchNavbarInfo, POLL_INTERVALS.slow);
    startPoller(fetchUptime, POLL_INTERVALS.slow);
    startPoller(fetchTraffic, POLL_INTERVALS.slow);
    startPoller(fetchCpuTemperature, POLL_INTERVALS.quick);
    startPoller(fetchTelemetry, POLL_INTERVALS.telemetry);
    startPoller(fetchRssi, POLL_INTERVALS.quick);
    startPoller(fetchAds1015, POLL_INTERVALS.quick);
    startPoller(fetchVinStatus, POLL_INTERVALS.quick);
    startPoller(fetchRelays, POLL_INTERVALS.quick);
    startPoller(fetchStatusVpn, POLL_INTERVALS.slow);
    startPoller(fetchTvStatus, POLL_INTERVALS.tv);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        pollers.forEach(run => run(true));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeRuleModal();
        }
    });
});
