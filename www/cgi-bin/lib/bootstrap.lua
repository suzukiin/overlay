-- lib/bootstrap.lua

-- descobre o diretório deste arquivo (lib/)
local script_path = debug.getinfo(1, "S").source:sub(2)
local lib_dir = script_path:match("(.*/)")

-- adiciona a pasta lib ao package.path
package.path = package.path .. ";" .. lib_dir .. "?.lua"

-- opcional: helpers globais
local M = {}

function M.json_header()
    print("Content-Type: application/json\n")
end

return M