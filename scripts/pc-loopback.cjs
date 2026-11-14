// Expo's --localhost controls advertised URLs. Bind this PC preview's actual socket too.
const net = require('node:net')
const port = Number(process.env.MARINO_PC_PREVIEW_PORT)
if (Number.isInteger(port) && port >= 1024 && port <= 65535) {
	const listen = net.Server.prototype.listen
	net.Server.prototype.listen = function (...args) {
		if (args[0] && typeof args[0] === 'object' && Number(args[0].port) === port) {
			args[0] = { ...args[0], host: '127.0.0.1' }
		} else if (Number(args[0]) === port) {
			if (typeof args[1] === 'function' || args.length === 1) args.splice(1, 0, '127.0.0.1')
			else args[1] = '127.0.0.1'
		}
		return Reflect.apply(listen, this, args)
	}
}
