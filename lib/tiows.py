import asyncio, asyncssh, hashlib, random, ssl, threading, tiocache, websockets, zlib

def _counter():
	counter = 0
	while True:
		counter += 1
		yield counter

counter = _counter()

async def auto_save():
	while True:
		await asyncio.sleep(600)
		cache.save_to('/srv/var/cache/tiows')

async def connect(hostname):
	connections[hostname] = await asyncssh.connect(hostname, username = 'runner', known_hosts = '/etc/ssh/ssh_known_hosts')

async def get_environment(handler_id):
	lock.acquire()
	if handler_id in hostnames:
		hostname = hostnames[handler_id]
		context = contexts[handler_id]
		active = True
	else:
		hostname = min(pool, key = lambda hostname: pool[hostname] + random.random())
		pool[hostname] += 1
		while True:
			context = 's0-s0:c{},c{},c{},c{}'.format(*sorted(random.sample(range(1024), 4)))
			if context not in contexts.values():
				break
		hostnames[handler_id] = hostname
		contexts[handler_id] = context
		active = False
	if not hostname in connections:
		await connect(hostname)
	lock.release()
	return (hostname, context, active)

async def release_environment(handler_id):
	lock.acquire()
	hostname = hostnames[handler_id]
	pool[hostname] -= 1
	del contexts[handler_id]
	del hostnames[handler_id]
	lock.release()

connections = {}
contexts = {}
hostnames = {}
lock = threading.Lock()
pool = {'tio1': 0, 'tio2': 0}

async def consumer(websocket, handler_id):
	try:
		while True:
			message = await websocket.recv()
			if message[:4] == 'PROB':
				key = int(message[4:], 16).to_bytes(32, 'big')
				try:
					await websocket.send(cache[key])
				except:
					pass
				continue
			hostname, context, active = await get_environment(handler_id)
			connection = connections[hostname]
			if active:
				await connection.run('killall -Z {0} -INT; sleep 1; killall -Z {0} -KILL'.format(context))
				hostname, context, active = await get_environment(handler_id)
			if message == 'QUIT':
				await release_environment(handler_id)
				continue
			request = zlib.decompress(message, -zlib.MAX_WBITS)
			command = '/srv/bin/run {} /srv/bin/run-sandbox 60 65 false'.format(context)
			process = await connection.create_process(command, input = request, encoding = None)
			response = zlib.compress(await process.stdout.read())[2:-4]
			await websocket.send(response)
			await release_environment(handler_id)
			cache[hashlib.sha256(message).digest()] = response
	except websockets.exceptions.ConnectionClosed:
		pass

async def handler(websocket, _):
	ip, port = websocket.remote_address
	handler_id = next(counter)
	print('{:012x} {} {}:{}'.format(handler_id, 'CONNECT', ip, port))
	_, pending = await asyncio.wait(
		[asyncio.ensure_future(consumer(websocket, handler_id)) for _ in range(2)],
		return_when = asyncio.FIRST_COMPLETED
	)
	for task in pending:
		task.cancel()
	print('{:012x} {}'.format(handler_id, 'CLOSE'))

context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
context.load_cert_chain('/etc/letsencrypt/live/tio.run/fullchain.pem', '/etc/letsencrypt/live/tio.run/privkey.pem')
start_server = websockets.serve(handler, 'tio.run', 8080, ssl = context)

try:
	cache = tiocache.Cache.load_from('/srv/var/cache/tiows')
except:
	cache = tiocache.Cache(32, 120 << 20, 128 << 20)

try:
	asyncio.ensure_future(auto_save())
	asyncio.get_event_loop().run_until_complete(start_server)
	asyncio.get_event_loop().run_forever()
except:
	cache.save_to('/srv/var/cache/tiows')
	raise
