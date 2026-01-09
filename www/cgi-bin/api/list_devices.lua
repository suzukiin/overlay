#!/usr/bin/lua
package.path = package.path .. ";../lib/?.lua"

local bootstrap = require "bootstrap"
local json = require "json"

local devices = json.getDevices()

bootstrap.json_header()
if not devices then
    print([[{
        "success": false,
        "error": "Não foi possível obter a lista de dispositivos"
    }]])
    return
end
print([[{
    "devices": ]])
print(require("cjson").encode(devices))
print([[}]])