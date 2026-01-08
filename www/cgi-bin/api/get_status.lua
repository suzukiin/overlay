#!/usr/bin/lua
-- adiciona ../lib ao package.path
package.path = package.path .. ";../lib/?.lua"

local bootstrap = require "bootstrap"
local vpn = require "vpn"
local lte = require "lte"
local json = require "json"

bootstrap.json_header()

local vpn_status, vpn_ip = vpn.get_status()
local rssi = lte.get_rssi()
local status_info = json.getInfo()

print(string.format([[
{
  "vpn": {
    "status": "%s",
    "ip": %s
  },
  "lte": {
    "rssi": %s
  },
  "status_info": {
    "localidade": "%s",
    "cliente": "%s",
    "id": "%s"
  }
}]],
    vpn_status,
    vpn_ip and '"' .. vpn_ip .. '"' or "null",
    rssi or "null",
    status_info.cidade or "",
    status_info.client or "",
    status_info.numero_de_serie or "****"
))
