var a = 1
location = "x"

var read = () => location
assert(read() === "")
var write = (x) => location = x
write("y")

let n = 0
if (n) debugger
else n = 1
assert(n === 1)

var h = () => 2
n = h
debugger
(3)
assert(n === h)

for (var { ...rest } of [{}]) location = "z"

switch (n) {
	default:
		n = 1
		location = "w"
}
assert(n === 1)
