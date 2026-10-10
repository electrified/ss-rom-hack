local output_dir = assert(os.getenv('SS_KIT_COLOUR_OUTPUT_DIR'))
local screen = manager.machine.screens[':megadriv']
local pad = manager.machine.ioport.ports[':ctrl1:mdpad:PAD'].fields

local function press(name)
  local field = pad[name]
  field:set_value(1)
  emu.wait(0.08)
  field:clear_value()
  emu.wait(0.4)
end

local function capture(name)
  screen:snapshot(output_dir .. '/' .. name .. '.png')
end

-- Wait for the title sequence, then open Custom Teams > Edit Teams.
emu.wait(35)
press('P1 Up')
press('P1 B')
emu.wait(2)
press('P1 Up')
press('P1 B')
emu.wait(2)
press('P1 B')
emu.wait(1)

-- Select the second kit's shirt, which starts with black as its main colour.
press('P1 Right')
press('P1 Down')
press('P1 Down')
capture('black')

-- With B held, Right advances the highlighted shirt through all ten colours.
pad['P1 B']:set_value(1)
emu.wait(0.1)
for _, name in ipairs({
  'dark-red', 'red', 'orange', 'yellow', 'green',
  'white', 'grey', 'light-blue', 'blue'
}) do
  press('P1 Right')
  capture(name)
end
pad['P1 B']:clear_value()
