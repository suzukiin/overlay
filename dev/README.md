# Fontes C do JUPITER

Os CGI compilados desta pasta são instalados em `overlay/www/cgi-bin`.

```sh
make check
make
make install
```

Para compilação cruzada, informe o prefixo da toolchain:

```sh
make CROSS_COMPILE=aarch64-linux-gnu-
make CROSS_COMPILE=aarch64-linux-gnu- install
```

O monitor possui dependências adicionais e é compilado separadamente:

```sh
make monitor
make install-monitor
```

Os endpoints de informações, logs, VPN, VIN, ADS1015 e agendamento são scripts
POSIX em `overlay/www/cgi-bin`; não fazem parte deste build C.
