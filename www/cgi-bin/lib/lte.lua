local M = {}

local DEV = "/dev/ttyUSB1"

local function open_port()
    local f = io.open(DEV, "r+")
    if not f then return nil end
    f:setvbuf("no")
    return f
end

function M.get_rssi()
    local f = open_port()
    if not f then
        return nil, "cannot open modem"
    end

    -- envia comando
    f:write("AT+CSQ\r")
    f:flush()

    local rssi

    -- lê poucas linhas (simula timeout)
    for _ = 1, 10 do
        local line = f:read("*l")
        if not line then break end

        -- DEBUG (recomendo deixar agora)
        print("RX:", line)

        if line:match("%+CSQ") then
            rssi = line:match("%+CSQ:%s*(%d+),")
            break
        end
    end

    f:close()

    if not rssi or rssi == "99" then
        return nil, "invalid rssi"
    end

    return -113 + (tonumber(rssi) * 2)
end

return M
