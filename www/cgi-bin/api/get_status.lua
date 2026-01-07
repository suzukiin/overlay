package.path = package.path .. ";../lib/?.lua"

local bootstrap = require "bootstrap"
local vpn = require "vpn"
local lte = require "lte"

local vpn_ip = vpn.get_ip_vpn()
local rssi = lte.get_rssi()

bootstrap.json_header()

if vpn_ip then
    print(string.format('{"vpn": {"status": "up", "ip": "%s"}}', vpn_ip))
else
    print('{"vpn": {"status": "down", "ip": null}}')
end

if rssi then
    print(string.format('{"lte": {"rssi": %d}}', rssi))
else
    print('{"lte": {"rssi": null}}')
end
