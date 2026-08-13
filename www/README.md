# Raiz web do JUPITER

A interface do dispositivo é servida diretamente pelo `httpd` do BusyBox a
partir de `/www`.

- `index.html`: dashboard estático.
- `public/`: arquivos do navegador e JSON de telemetria gerado pelo monitor.
- `cgi-bin/`: executáveis CGI e scripts POSIX shell.

O `/usr/bin/jupiter-web` inicia o `httpd` em primeiro plano para que o
`jupiter-services` possa supervisioná-lo. A configuração de execução continua
em `/etc/jupiter` e `/home/proc`; ela não é duplicada na raiz web.

## Modo econômico de dados

A interface é servida sem CDNs, fontes externas ou Bootstrap remoto para evitar
downloads pela conexão celular. As atualizações automáticas usam intervalos de
2 minutos para leituras locais e 10 minutos para telemetria/tráfego; logs e
agendamento continuam sendo carregados apenas sob demanda.

## TV digital ISDB-T

Quando o MyGica S270 está conectado e os utilitários DVB/FFmpeg estão presentes
na imagem, a seção `TV Digital ISDB-T` permite descobrir e visualizar os canais
abertos captados pela antena.

A visualização atual funciona como amostra sob demanda: cada solicitação gera
15 segundos em 640×360, com vídeo H.264 a aproximadamente 450 kbit/s e áudio
AAC a 64 kbit/s. O encoder `libx264` precisa estar disponível no FFmpeg da
imagem.

O controlador é iniciado junto com os demais serviços:

```sh
jupiter-services restart
```

Para verificar o estado diretamente:

```sh
cat /etc/jupiter/tv.json
cat /var/lib/jupiter/tv/state.json
cat /var/lib/jupiter/tv/channels.json
tail -f /var/log/jupiter/tv.log
```

Na primeira utilização, clique em `Atualizar canais`. A varredura usa o arquivo
de frequências definido em `/etc/jupiter/tv.json` e preserva o último resultado
válido. Depois selecione um serviço e clique em `Iniciar visualização`.

A amostra é publicada localmente como HLS VOD em
`/public/tv/<sessao>/index.m3u8`. Somente uma sessão é mantida por vez, e os
segmentos antigos são removidos automaticamente. Não há gravação permanente do
transporte MPEG-TS.

Ao escolher um canal, a interface também mostra o `service_id`, a frequência e
os PIDs de vídeo e áudio encontrados na varredura. Durante a captura, a página
exibe `GERANDO AMOSTRA`; a reprodução começa somente quando a playlist VOD é
finalizada.

Se a imagem usar outro arquivo de frequências, altere apenas:

```json
{
  "scan_input_file": "/usr/share/dvbv5/isdb-t/br-sp-SaoPaulo"
}
```

Os endpoints locais são `tv-status`, `tv-channels`, `tv-scan`, `tv-select` e
`tv-stop`, todos servidos pelo mesmo BusyBox `httpd` da telemetria.
