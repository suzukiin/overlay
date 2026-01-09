#!/usr/bin/lua

package.path = package.path .. ";../lib/?.lua"

local bootstrap = require "bootstrap"
local network = require "network"

bootstrap.json_header()

local qs = os.getenv("QUERY_STRING") or ""
local ip = qs:match("ip=([^&]+)")

if not ip or ip == "" then
    print([[{
        "success": false,
        "error": "IP não informado"
    }]])
    return
end

ip = ip:gsub("%%2F", "/")

local ok, err = network.add_eth0_ip(ip)

if not ok then
    print(string.format([[{
        "success": false,
        "error": "%s"
    }]], err))
    return
end

print([[{
    "success": true
}]])
