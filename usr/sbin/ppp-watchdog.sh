#!/bin/sh

PEER="VIVO-PEERS"
PPP_IF="ppp0"
MODEM_DEV="/dev/ttyUSB2"

log() {
    echo "<6>[ppp-watchdog] $1" > /dev/kmsg
}

while true; do
    # modem sumiu?
    if [ ! -e "$MODEM_DEV" ]; then
        log "modem não encontrado, aguardando..."
        sleep 5
        continue
    fi

    # ppp caiu?
    if ! ip addr show "$PPP_IF" 2>/dev/null | grep -q "inet "; then
        log "ppp0 fora do ar, reiniciando PPP"

        killall pppd 2>/dev/null
        sleep 2

        pppd call "$PEER" &
    fi

    sleep 10
done
