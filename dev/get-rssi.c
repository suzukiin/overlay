#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <fcntl.h>
#include <termios.h>
#include <unistd.h>

static int write_command(int fd, const char *command, size_t length) {
    size_t written = 0;

    while (written < length) {
        ssize_t result = write(fd, command + written, length - written);

        if (result < 0 && errno == EINTR) {
            continue;
        }
        if (result <= 0) {
            return -1;
        }
        written += (size_t)result;
    }

    return 0;
}

int main() {
    int fd;
    char buffer[512];
    struct termios options;

    printf("Content-Type: application/json\r\n\r\n");

    fd = open("/dev/ttyUSB1", O_RDWR | O_NOCTTY); // Removi o O_NDELAY para ele esperar os dados
    if (fd == -1) {
        printf("{\"status\": \"Error\", \"msg\": \"Erro ao abrir porta\"}\n");
        return 1;
    }

    // Configuração padrão de porta serial
    if (tcgetattr(fd, &options) != 0) {
        close(fd);
        printf("{\"status\": \"Error\", \"msg\": \"Erro ao configurar porta\"}\n");
        return 1;
    }

    cfmakeraw(&options);
    cfsetispeed(&options, B115200);
    cfsetospeed(&options, B115200);
    options.c_cflag &= ~(PARENB | CSTOPB | CSIZE);
    options.c_cflag |= (CLOCAL | CREAD | CS8);
    options.c_cc[VMIN] = 0;  // Não bloqueia a leitura
    options.c_cc[VTIME] = 10; // Timeout de 1 segundo (10 * 0.1s)
    if (tcsetattr(fd, TCSANOW, &options) != 0) {
        close(fd);
        printf("{\"status\": \"Error\", \"msg\": \"Erro ao configurar porta\"}\n");
        return 1;
    }

    // 1. Limpar sujeira residual
    tcflush(fd, TCIOFLUSH);

    // 2. Opcional: Desligar o ECO para facilitar a vida
    if (write_command(fd, "ATE0\r\n", 6) != 0) {
        close(fd);
        printf("{\"status\": \"Error\", \"msg\": \"Erro ao comunicar com modem\"}\n");
        return 1;
    }
    usleep(100000); 
    tcflush(fd, TCIFLUSH); // Limpa o eco do ATE0

    // 3. Enviar o comando real
    if (write_command(fd, "AT+CSQ\r\n", 8) != 0) {
        close(fd);
        printf("{\"status\": \"Error\", \"msg\": \"Erro ao comunicar com modem\"}\n");
        return 1;
    }

    // 4. Ler até 511 bytes (o timeout de 1s ajuda aqui)
    memset(buffer, 0, sizeof(buffer));
    int total_lido = 0;
    int n;
    
    // Pequeno loop para garantir que pegamos a resposta que demora a chegar
    for(int i=0; i<5; i++) {
        n = read(fd, buffer + total_lido, sizeof(buffer) - (size_t)total_lido - 1);
        if (n > 0) total_lido += n;
        if (n < 0 && errno != EINTR) break;
        if (strstr(buffer, "OK") || strstr(buffer, "ERROR")) break;
        usleep(200000); // Espera 200ms entre tentativas
    }

    // 5. Processar resultado
    char *p = strstr(buffer, "+CSQ:");
    if (p) {
        int rssi, ber;
        if (sscanf(p, "+CSQ: %d,%d", &rssi, &ber) == 2) {
            printf("{\"status\": \"Success\", \"data\": {\"rssi\": %d}}\n", rssi);
        } else {
            printf("{\"status\": \"Error\", \"msg\": \"Falha ao extrair valores RSSI\"}\n");
        }
    } else {
        printf("{\"status\": \"Error\", \"msg\": \"Sem resposta valida do modem\"}\n");
    }

    close(fd);
    return 0;
}
