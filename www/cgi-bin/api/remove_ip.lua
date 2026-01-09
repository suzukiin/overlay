#!/usr/bin/lua
package.path = package.path .. ";../lib/?.lua"

local network = require "network"

-- Cabeçalho HTTP
print("Content-Type: application/json\n")

-- Lê QUERY_STRING
local qs = os.getenv("QUERY_STRING") or ""
local ip = qs:match("ip=([^&]+)")

if not ip then
    print('{"success":false,"error":"IP não informado"}')
    return
end

-- decode básico (%2F etc)
ip = ip:gsub("%%(%x%x)", function(h)
    return string.char(tonumber(h, 16))
end)

local ok, err = network.remove_eth0_ip(ip)

if not ok then
    print(string.format(
        '{"success":false,"error":"%s"}',
        err or "Erro ao remover IP"
    ))
    return
end

print('{"success":true}')
