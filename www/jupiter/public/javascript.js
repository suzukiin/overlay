document.addEventListener("DOMContentLoaded", function () {

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

        const resopnse = await fetch("/cgi-bin/get-traffic");
        const res = await resopnse.json();

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
        const response = await fetch("/cgi-bin/get-log-watchdog");
        const res = await response.json();

        if (res.status == "Success") {
            const logsBody = document.getElementById("logs-body");
            logsBody.innerHTML = "";

            res.logs.forEach(logLine => {
                const parts = logLine.split(" - ");
                const timestamp = parts[0] || "--";
                const message = parts[1] || logLine;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="font-mono small">${timestamp}</td>
                    <td><span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 small">INFO</span></td>
                    <td class="text-muted small">WATCHDOG</td>
                    <td class="text-light small">${message}</td>
                `;
                logsBody.appendChild(tr);
            });
        } else {
            window.alert("Erro: " + res.msg);

        }
    }

    async function fetchTelemetry() {
        try {
            const response = await fetch("public/telemetry_data.json?nocache=" + new Date().getTime());
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
                    const gain = channel.gain;
                    const offset = channel.offset;

                    const voltageElement = document.getElementById(`ads-ch${ch}-voltage`);
                    const rawElement = document.getElementById(`ads-ch${ch}-raw`);
                    const statusElement = document.getElementById(`ads-ch${ch}-status`);
                    const gainElement = document.getElementById(`ads-ch${ch}-gain`);
                    const offsetElement = document.getElementById(`ads-ch${ch}-offset`);

                    if (voltageElement && rawElement && statusElement && gainElement && offsetElement) {
                        voltageElement.textContent = `Entrada: ${voltage.toFixed(3)} V`;
                        rawElement.textContent = `ADS: ${adsVoltage.toFixed(3)} V | raw: ${raw} | k: ${kernelScale}`;
                        statusElement.textContent = "OK";
                        statusElement.className = "text-success font-mono";

                        if (document.activeElement !== gainElement) {
                            gainElement.value = gain;
                        }
                        if (document.activeElement !== offsetElement) {
                            offsetElement.value = offset;
                        }
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
        }
    }

    async function setAdsCalibration(channel) {
        const gainElement = document.getElementById(`ads-ch${channel}-gain`);
        const offsetElement = document.getElementById(`ads-ch${channel}-offset`);
        const statusElement = document.getElementById(`ads-ch${channel}-status`);
        const gain = gainElement ? gainElement.value.trim() : "";
        const offset = offsetElement ? offsetElement.value.trim() : "0";

        if (!/^[0-9]+(\.[0-9]+)?$/.test(gain)) {
            window.alert("Ganho inválido. Para o divisor 68k/33k use inicialmente 3.060606.");
            return;
        }

        if (!/^-?[0-9]+(\.[0-9]+)?$/.test(offset)) {
            window.alert("Offset inválido. Use número em volts, exemplo: 0 ou -0.015");
            return;
        }

        try {
            if (statusElement) {
                statusElement.textContent = "SALVANDO";
                statusElement.className = "text-warning font-mono";
            }

            const response = await fetch(`/cgi-bin/get-ads1015?channel=${channel}&gain=${encodeURIComponent(gain)}&offset=${encodeURIComponent(offset)}`, {
                method: "POST"
            });
            const res = await response.json();

            if (res.status === "Success") {
                fetchAds1015();
            } else {
                window.alert("Erro ao salvar scale: " + (res.msg || "--"));
                fetchAds1015();
            }
        } catch (error) {
            console.error("Erro ao salvar calibração do ADS1015:", error);
            window.alert("Erro ao salvar calibração");
            fetchAds1015();
        }
    }

    async function fetchStatusVpn() {

        const response = await fetch("/cgi-bin/get-status-vpn");
        const res = await response.json();

        var connectionBagdeElement = document.getElementById("connection-badge");
        var connectionDotElement = document.getElementById("connection-dot");
        var connectionTextElement = document.getElementById("connection-text");

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

    fetchStatusVpn();
    fetchLogs();
    fetchNavbarInfo();
    fetchUptime();
    fetchTraffic();
    fetchCpuTemperature();
    fetchTelemetry();
    fetchRssi();
    fetchAds1015();

    window.fetchLogs = fetchLogs;
    window.setAdsCalibration = setAdsCalibration;

    // Relay Control Functions
    async function fetchRelays() {
        try {
            const response = await fetch("/cgi-bin/relay-control");
            const res = await response.json();

            if (res.status == "Success") {
                const relay1Toggle = document.getElementById("relay1-toggle");
                const relay2Toggle = document.getElementById("relay2-toggle");
                
                relay1Toggle.checked = res.data.relay1;
                relay2Toggle.checked = res.data.relay2;
            } else {
                console.error("Erro ao buscar estado dos relés:", res.msg);
            }
        } catch (error) {
            console.error("Erro na requisição de relés:", error);
        }
    }

    async function setRelay(relay, state) {
        try {
            const response = await fetch(`/cgi-bin/relay-control?relay=${relay}&state=${state ? 1 : 0}`, {
                method: "POST"
            });
            const res = await response.json();

            if (res.status == "Success") {
                const relay1Toggle = document.getElementById("relay1-toggle");
                const relay2Toggle = document.getElementById("relay2-toggle");
                
                relay1Toggle.checked = res.data.relay1;
                relay2Toggle.checked = res.data.relay2;
            } else {
                console.error("Erro ao alterar relé:", res.msg);
                // Restaurar estado visual anterior
                fetchRelays();
            }
        } catch (error) {
            console.error("Erro na requisição de alteração de relé:", error);
            // Restaurar estado visual anterior
            fetchRelays();
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

    // Load initial relay state and update periodically
    fetchRelays();
    setInterval(fetchRelays, 5000);
    setInterval(fetchAds1015, 5000);

    // ============ RELAY SCHEDULER FUNCTIONS ============
    
    let scheduleData = {
        schema_version: 1,
        enabled: true,
        timezone: "local",
        rules: []
    };

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

    async function fetchScheduleConfig() {
        try {
            setScheduleSaveStatus("carregando", "secondary");
            const response = await fetch("/cgi-bin/relay-schedule");
            const res = await response.json();

            if (res.status == "Success" && res.data) {
                scheduleData = normalizeScheduleData(res.data);
                renderScheduleRules();
                setScheduleSaveStatus("sincronizado", "success");
            } else {
                console.error("Error fetching schedule:", res.msg);
                renderScheduleRules(); // Show empty
                setScheduleSaveStatus("erro", "danger");
            }
        } catch (error) {
            console.error("Error fetching schedule config:", error);
            renderScheduleRules();
            setScheduleSaveStatus("erro", "danger");
        }
    }

    function renderScheduleRules() {
        const container = document.getElementById("schedule-rules-container");
        updateSchedulerHeader();

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
                            <td><span class="badge bg-dark border border-secondary text-secondary font-mono">Relé ${rule.relay}</span></td>
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
            relay: 1,
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
            <div class="modal fade" id="ruleModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark border border-secondary border-opacity-25">
                        <div class="modal-header border-secondary border-opacity-25">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
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
                                    <option value="1" ${rule.relay == 1 ? 'selected' : ''}>Relé 1</option>
                                    <option value="2" ${rule.relay == 2 ? 'selected' : ''}>Relé 2</option>
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
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-jupiter" onclick="saveScheduleRule(${index})">Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove old modal if exists
        const oldModal = document.getElementById("ruleModal");
        if (oldModal) {
            oldModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML("beforeend", modal);

        // Show modal
        const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
        ruleModal.show();
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

        // Close modal and save
        bootstrap.Modal.getInstance(document.getElementById("ruleModal")).hide();
        setTimeout(() => {
            document.getElementById("ruleModal").remove();
            saveScheduleConfig();
        }, 300);
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

    const schedulerEnabled = document.getElementById("scheduler-enabled");
    const scheduleAddBtn = document.getElementById("schedule-add-btn");
    const scheduleRefreshBtn = document.getElementById("schedule-refresh-btn");

    if (schedulerEnabled) {
        schedulerEnabled.addEventListener("change", updateSchedulerState);
    }
    if (scheduleAddBtn) {
        scheduleAddBtn.addEventListener("click", addScheduleRule);
    }
    if (scheduleRefreshBtn) {
        scheduleRefreshBtn.addEventListener("click", fetchScheduleConfig);
    }

    // Load schedule on startup
    fetchScheduleConfig();

    setInterval(fetchUptime, 60000);
    setInterval(fetchCpuTemperature, 10000);
    setInterval(fetchTelemetry, 10000);
    setInterval(fetchRssi, 10000);
});
