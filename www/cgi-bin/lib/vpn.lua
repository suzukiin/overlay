local os = require "os"
local io = require "io"

local function get_ip_vpn()
    local pipe = io.popen("tailscale ip -4 2>/dev/null")
    if not pipe then
        return nil
    end

    local output = pipe:read("*a")
    pipe:close()

    output = output and output:gsub("%s+", "")
    if output == "" then
        return nil
    end

    return output
end

return {
    get_ip_vpn = get_ip_vpn
}