#!/usr/bin/lua
local cjson = require "cjson"
local f = io.open("/home/lucas/overlay/www/config.json", "r")

local M = {}

function M.getInfo()
    local content = f:read("*a")
    f:close()

    local data = cjson.decode(content)
    return data.info
end

return M