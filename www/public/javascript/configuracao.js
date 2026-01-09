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

async function getEth0IPs() {
    try {
        const res = await fetch('/cgi-bin/api/get_eth0_ips.lua');
        const data = await res.json();

        const list_ips = document.getElementById('eth0_ips');
        list_ips.innerHTML = '';

        data.eth0_ips.forEach(ip => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';

            // Lado esquerdo: IP
            const ipText = document.createElement('span');
            ipText.innerText = ip;

            // Lado direito: badge + botão
            const actions = document.createElement('div');

            const badge = document.createElement('span');
            badge.className = 'badge text-bg-success me-2';
            badge.innerText = 'Ativo';

            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-outline-danger';
            btn.innerText = 'Excluir';

            // Evento de clique
            btn.addEventListener('click', () => {
                removeEth0Ip(ip);
            });

            actions.appendChild(badge);
            actions.appendChild(btn);

            li.appendChild(ipText);
            li.appendChild(actions);

            list_ips.appendChild(li);
        });

    } catch (err) {
        console.error('Erro ao obter IPs eth0:', err);
    }
}

document.getElementById('form_add_ip').addEventListener('submit', function (e) {
    e.preventDefault();
    addEth0Ip();
});

async function addEth0Ip() {
    try {
        const ip = document.getElementById('ip').value.trim();
        if (!ip) {
            alert('Informe um IP');
            return;
        }

        const res = await fetch(`/cgi-bin/api/add_ip.lua?ip=${encodeURIComponent(ip)}`);
        const data = await res.json();

        if (data.success) {
            document.getElementById('ip').value = '';
            getEth0IPs();
        } else {
            alert(`Erro ao adicionar IP: ${data.error}`);
        }
    } catch (err) {
        console.error('Erro ao adicionar IP:', err);
    }
}

async function removeEth0Ip(ip) {
    if (!confirm(`Deseja remover o IP ${ip}?`)) {
        return;
    }

    try {
        const res = await fetch(`/cgi-bin/api/remove_ip.lua?ip=${encodeURIComponent(ip)}`);
        const data = await res.json();

        if (data.success) {
            getEth0IPs();
        } else {
            alert(`Erro ao remover IP: ${data.error}`);
        }
    } catch (err) {
        console.error('Erro ao remover IP:', err);
    }
}

getEth0IPs();
loadStatus();
setInterval(loadStatus, 60000);
setInterval(getEth0IPs, 30000);



