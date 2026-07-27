OVERLAY ?= ../overlay
BUILD_DIR ?= build
CGI_DIR := $(OVERLAY)/www/cgi-bin

ifeq ($(origin CC),default)
CC := $(CROSS_COMPILE)gcc
endif

CPPFLAGS ?= -D_DEFAULT_SOURCE
CFLAGS ?= -O2 -Wall -Wextra -Wpedantic
LDFLAGS ?=

CGI_NAMES := get-rssi get-temp-cpu get-traffic get-uptime relay-control
CGI_BINS := $(addprefix $(BUILD_DIR)/,$(CGI_NAMES))
MONITOR_LIBS ?= -lmosquitto -lcjson -lnetsnmp -lm

.PHONY: all cgi monitor install install-cgi install-monitor check clean

all: cgi

cgi: $(CGI_BINS)

monitor: $(BUILD_DIR)/monitor

$(BUILD_DIR):
	mkdir -p $@

$(BUILD_DIR)/%: %.c | $(BUILD_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(LDFLAGS) -o $@ $<

$(BUILD_DIR)/monitor: monitor.c | $(BUILD_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(LDFLAGS) -o $@ $< $(MONITOR_LIBS)

install: install-cgi

install-cgi: cgi
	install -d $(CGI_DIR)
	install -m 0755 $(CGI_BINS) $(CGI_DIR)/

install-monitor: monitor
	install -m 0755 $(BUILD_DIR)/monitor $(OVERLAY)/home/proc/monitor

check:
	@for source in $(addsuffix .c,$(CGI_NAMES)); do \
		$(CC) $(CPPFLAGS) $(CFLAGS) -fsyntax-only $$source || exit; \
	done

clean:
	rm -rf $(BUILD_DIR)
