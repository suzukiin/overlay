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
