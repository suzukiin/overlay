local M = {}
local io = require "io"

local CFG = "/etc/network/eth0.cfg"

function M.get_cfg_eth0()
    local ips = {}
    local f = io.open(CFG, "r")
    if not f then return ips end

    for line in f:lines() do
        line = line:match("^%s*(.-)%s*$")
        if line ~= "" then
            table.insert(ips, line)
        end
    end

    f:close()
    return ips
end

function M.add_eth0_ip(ip)
    -- evita duplicado
    for _, v in ipairs(M.get_cfg_eth0()) do
        if v == ip then
            return false, "IP já existe"
        end
    end

    -- aplica imediatamente
    os.execute("ip addr add " .. ip .. " dev eth0 2>/dev/null")

    -- persiste
    local f = io.open(CFG, "a")
    if not f then
        return false, "Não foi possível abrir " .. CFG
    end

    f:write(ip .. "\n")
    f:close()

    return true
end

function M.remove_eth0_ip(ip)
    local ips = M.get_cfg_eth0()
    local f = io.open(CFG, "w")
    if not f then return false end

    for _, v in ipairs(ips) do
        if v ~= ip then
            f:write(v .. "\n")
        end
    end

    f:close()
    os.execute("ip addr del " .. ip .. " dev eth0 2>/dev/null")
    return true
end

return M
