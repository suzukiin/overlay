async function loadStatus() {
    try {
        const res = await fetch('/cgi-bin/api/get_status.lua');
        const data = await res.json();

        document.getElementById('status_ip_vpn').innerText = data.vpn.ip || 'N/A';
        document.getElementById('status_vpn');
        document.getElementById('status_lte_level').innerText = `${data.lte.rssi} dBm` || 'N/A';
        document.getElementById('status_lte_status');
        document.getElementById('status_info_local').innerText = data.status_info.localidade || 'N/A';
        document.getElementById('status_info_client').innerText = data.status_info.cliente || 'N/A';
        document.getElementById('status_info_id').innerText = data.status_info.id || 'N/A';

        if (data.vpn.status === "up") {
            status_vpn.className = 'badge text-bg-success';
            status_vpn.innerText = 'Conectado';
        } else {
            status_vpn.className = 'badge text-bg-danger';
            status_vpn.innerText = 'Desconectado';
        }

        if (data.lte.rssi >= -85) {
            status_lte_status.className = 'badge text-bg-success';
            status_lte_status.innerText = 'Bom';
        } else if (data.lte.rssi >= -100) {
            status_lte_status.className = 'badge text-bg-warning';
            status_lte_status.innerText = 'Médio';
        } else {
            status_lte_status.className = 'badge text-bg-danger';
            status_lte_status.innerText = 'Fraco';
        }

    } catch (err) {
        console.error('Erro ao carregar status:', err);
    }
}

loadStatus();

setInterval(loadStatus, 60000);