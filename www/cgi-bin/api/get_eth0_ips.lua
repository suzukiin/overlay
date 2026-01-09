#!/usr/bin/lua
package.path = package.path .. ";../lib/?.lua"

local bootstrap = require "bootstrap"
local network = require "network"

local ips = network.get_cfg_eth0()

bootstrap.json_header()

print("{\"eth0_ips\": [")
for i, ip in ipairs(ips) do
    if i > 1 then
        io.write(", ")
    end
    io.write(string.format("\"%s\"", ip))
end
print("]}")