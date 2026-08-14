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

Na primeira utilização, escolha a região da varredura e clique em `Atualizar
canais`. A lista é montada a partir dos arquivos `br-*` instalados em
`/usr/share/dvb/isdb-t` (ou no diretório definido por `scan_table_dir`). Por
exemplo, ao viajar para São Paulo, selecione uma tabela `br-sp-*` disponível e
faça uma nova varredura. O resultado anterior é preservado até que a nova
varredura termine com sucesso. Depois selecione um serviço e clique em
`Iniciar visualização`.

A amostra é publicada localmente como HLS VOD em
`/public/tv/<sessao>/index.m3u8`. Somente uma sessão é mantida por vez, e os
segmentos antigos são removidos automaticamente. Não há gravação permanente do
transporte MPEG-TS.

Ao escolher um canal, a interface também mostra o `service_id`, a frequência,
os PIDs, codecs, modulação, largura de banda, intervalo de guarda, modo de
transmissão, code rates HP/LP e inversão encontrados na varredura. Durante a
captura, a página exibe `GERANDO AMOSTRA`; a reprodução começa somente quando
a playlist VOD é finalizada.

As tabelas regionais disponíveis e a região selecionada podem ser consultadas
diretamente:

```sh
wget -qO- http://127.0.0.1/cgi-bin/tv-regions
cat /var/lib/jupiter/tv/selected-region
```

O arquivo `scan_input_file` continua sendo o fallback inicial. Se a imagem usar
outro diretório de tabelas, altere:

```json
{
  "scan_input_file": "/usr/share/dvb/isdb-t/br-pr-Curitiba",
  "scan_table_dir": "/usr/share/dvb/isdb-t",
  "region_state_file": "/var/lib/jupiter/tv/selected-region"
}
```

Os endpoints locais são `tv-status`, `tv-regions`, `tv-channels`, `tv-scan`,
`tv-select` e `tv-stop`, todos servidos pelo mesmo BusyBox `httpd` da
telemetria. A varredura aceita a região escolhida por
`POST /cgi-bin/tv-scan?region_id=sp-SaoPaulo`.
