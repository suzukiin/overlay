#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main()
{
    printf("Content-Type: application/json\r\n\r\n");

    FILE *fp = fopen("/proc/net/dev", "r");
    if (fp == NULL)
    {
        printf("{\"status\": \"Error\", \"msg\": \"Nao foi possivel abrir o arquivo\"}\n");
        return 1;
    }

    char line[256];
    char current_if[32];
    unsigned long rx, tx, d1, d2, d3, d4, d5, d6, d7;

    if (fgets(line, sizeof(line), fp) == NULL || fgets(line, sizeof(line), fp) == NULL)
    {
        printf("{\"status\": \"Error\", \"msg\": \"Formato invalido de /proc/net/dev\"}\n");
        fclose(fp);
        return 1;
    }

    while (fgets(line, sizeof(line), fp))
    {

        if (sscanf(line, " %31[^:]: %lu %lu %lu %lu %lu %lu %lu %lu %lu",
                   current_if, &rx, &d1, &d2, &d3, &d4, &d5, &d6, &d7, &tx) >= 2)
        {
            if (strcmp(current_if, "ppp0") == 0)
            {
                printf("{\"status\": \"Success\", \"data\": {\"interface\": \"ppp0\", \"rx_mb\": %.2f, \"tx_mb\": %.2f}}\n", 
                       (double)rx / (1024 * 1024), 
                       (double)tx / (1024 * 1024));
                fclose(fp);
                return 0;
            }
        }
    }

    printf("{\"status\": \"Error\", \"msg\": \"Interface ppp0 nao encontrada\"}\n");
    fclose(fp);
    return 1;
}
