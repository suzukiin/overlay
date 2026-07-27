#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifndef RELAY_STATE_FILE
#define RELAY_STATE_FILE "/var/lib/jupiter/state/relay_state"
#endif
#ifndef LEGACY_RELAY_STATE_FILE
#define LEGACY_RELAY_STATE_FILE "/etc/jupiter/relay_state"
#endif
#ifndef UPS_ENABLE_PATH
#define UPS_ENABLE_PATH "/dev/relay1"
#endif
#ifndef RELAY2_PATH
#define RELAY2_PATH "/dev/relay2"
#endif

typedef struct {
    int ups_enabled;
    int relay2;
} RelayState;

int normalize_state(int value) {
    return value == 1 ? 1 : 0;
}

int read_int_file(const char *path, int *value) {
    FILE *fp = fopen(path, "r");
    int read_value;

    if (fp == NULL) {
        return -1;
    }

    if (fscanf(fp, "%d", &read_value) != 1) {
        fclose(fp);
        return -1;
    }

    fclose(fp);
    *value = normalize_state(read_value);
    return 0;
}

int write_int_file(const char *path, int value) {
    FILE *fp = fopen(path, "w");

    if (fp == NULL) {
        return -1;
    }

    if (fprintf(fp, "%d\n", normalize_state(value)) < 0 || fclose(fp) != 0) {
        return -1;
    }

    return 0;
}

RelayState read_persisted_relay_state() {
    RelayState state = {0, 0};
    FILE *fp = fopen(RELAY_STATE_FILE, "r");

    if (fp == NULL) {
        fp = fopen(LEGACY_RELAY_STATE_FILE, "r");
    }

    if (fp != NULL) {
        if (fscanf(fp, "%d %d", &state.ups_enabled, &state.relay2) != 2) {
            state.ups_enabled = 0;
            state.relay2 = 0;
        }
        fclose(fp);
    }

    state.ups_enabled = normalize_state(state.ups_enabled);
    state.relay2 = normalize_state(state.relay2);
    return state;
}

RelayState read_current_relay_state() {
    RelayState state = read_persisted_relay_state();
    int value;

    if (read_int_file(UPS_ENABLE_PATH, &value) == 0) {
        state.ups_enabled = value;
    }

    if (read_int_file(RELAY2_PATH, &value) == 0) {
        state.relay2 = value;
    }

    return state;
}

// Write relay state to persistence file
int write_relay_state(RelayState state) {
    FILE *fp = fopen(RELAY_STATE_FILE, "w");
    if (fp == NULL) {
        return -1;
    }
    fprintf(fp, "%d %d\n", normalize_state(state.ups_enabled), normalize_state(state.relay2));
    fclose(fp);

    fp = fopen(LEGACY_RELAY_STATE_FILE, "w");
    if (fp != NULL) {
        fprintf(fp, "%d %d\n", normalize_state(state.ups_enabled), normalize_state(state.relay2));
        fclose(fp);
    }

    return 0;
}

// Write state to /dev/relayN device
int write_device(int relay_num, int state) {
    const char *device_path = (relay_num == 1) ? UPS_ENABLE_PATH : RELAY2_PATH;
    int applied_state;

    if (write_int_file(device_path, state) != 0) {
        return -1;
    }

    if (read_int_file(device_path, &applied_state) != 0 ||
        applied_state != normalize_state(state)) {
        return -1;
    }

    return 0;
}

// Parse query string and extract parameter
char* get_param(const char *query, const char *param_name) {
    static char result[256];
    const char *segment;
    size_t name_len;

    result[0] = '\0';

    if (query == NULL || param_name == NULL) {
        return result;
    }

    name_len = strlen(param_name);
    segment = query;

    while (*segment != '\0') {
        const char *separator = strchr(segment, '&');
        const char *equals = strchr(segment, '=');
        const char *end = separator ? separator : segment + strlen(segment);

        if (equals != NULL && equals < end && (size_t)(equals - segment) == name_len &&
            strncmp(segment, param_name, name_len) == 0) {
            size_t value_len = (size_t)(end - equals - 1);

            if (value_len >= sizeof(result)) {
                value_len = sizeof(result) - 1;
            }
            memcpy(result, equals + 1, value_len);
            result[value_len] = '\0';
            return result;
        }

        if (separator == NULL) {
            break;
        }
        segment = separator + 1;
    }

    return result;
}

// Handle GET request - return current relay state
void handle_get() {
    RelayState state = read_current_relay_state();
    printf("{\"status\": \"Success\", \"data\": {\"relay1\": %s, \"relay2\": %s, \"ups_enabled\": %s}}\n",
           state.ups_enabled ? "true" : "false",
           state.relay2 ? "true" : "false",
           state.ups_enabled ? "true" : "false");
}

// Handle POST request - set relay state
void handle_post(const char *query) {
    char relay_str[10];
    char state_str[10];
    char target_str[32];
    
    strncpy(relay_str, get_param(query, "relay"), sizeof(relay_str) - 1);
    relay_str[sizeof(relay_str) - 1] = '\0';
    strncpy(state_str, get_param(query, "state"), sizeof(state_str) - 1);
    state_str[sizeof(state_str) - 1] = '\0';
    strncpy(target_str, get_param(query, "target"), sizeof(target_str) - 1);
    target_str[sizeof(target_str) - 1] = '\0';
    
    if (state_str[0] == '\0' || (relay_str[0] == '\0' && target_str[0] == '\0')) {
        printf("{\"status\": \"Error\", \"msg\": \"Missing relay/target or state parameter\"}\n");
        return;
    }
    
    int relay_num = 0;
    int new_state;

    if (strcmp(relay_str, "1") == 0) {
        relay_num = 1;
    } else if (strcmp(relay_str, "2") == 0) {
        relay_num = 2;
    }

    if (strcmp(state_str, "0") == 0) {
        new_state = 0;
    } else if (strcmp(state_str, "1") == 0) {
        new_state = 1;
    } else {
        printf("{\"status\": \"Error\", \"msg\": \"Invalid state value\"}\n");
        return;
    }

    if (strcmp(target_str, "ups") == 0 || strcmp(target_str, "battery") == 0) {
        relay_num = 1;
    }
    
    // Validate relay number
    if (relay_num != 1 && relay_num != 2) {
        printf("{\"status\": \"Error\", \"msg\": \"Invalid relay number\"}\n");
        return;
    }
    
    // Read current state
    RelayState state = read_current_relay_state();
    
    // Update the requested relay
    if (relay_num == 1) {
        state.ups_enabled = new_state;
    } else {
        state.relay2 = new_state;
    }
    
    // Write to device
    if (write_device(relay_num, new_state) != 0) {
        printf("{\"status\": \"Error\", \"msg\": \"Failed to apply relay state\", \"data\": {\"relay\": %d, \"device\": \"/dev/relay%d\"}}\n",
               relay_num, relay_num);
        return;
    }
    
    // Write to persistence file
    if (write_relay_state(state) != 0) {
        printf("{\"status\": \"Error\", \"msg\": \"Failed to persist state\"}\n");
        return;
    }
    
    printf("{\"status\": \"Success\", \"data\": {\"relay1\": %s, \"relay2\": %s, \"ups_enabled\": %s}}\n",
           state.ups_enabled ? "true" : "false",
           state.relay2 ? "true" : "false",
           state.ups_enabled ? "true" : "false");
}

int main() {
    printf("Content-Type: application/json\r\n\r\n");
    
    const char *method = getenv("REQUEST_METHOD");
    
    if (method == NULL) {
        printf("{\"status\": \"Error\", \"msg\": \"Cannot determine request method\"}\n");
        return 1;
    }
    
    if (strcmp(method, "GET") == 0) {
        handle_get();
    } else if (strcmp(method, "POST") == 0) {
        const char *query_string = getenv("QUERY_STRING");
        if (query_string == NULL) {
            query_string = "";
        }
        handle_post(query_string);
    } else {
        printf("{\"status\": \"Error\", \"msg\": \"Method not allowed\"}\n");
        return 1;
    }
    
    return 0;
}
