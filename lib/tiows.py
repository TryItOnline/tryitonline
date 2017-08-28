import asyncio, asyncssh, hashlib, random, socket, threading, tiocache, traceback, websockets, zlib

cache_file = '/srv/var/cache/tiows'

def _counter():
	counter = 0
	while True:
		counter += 1
		yield counter

counter = _counter()

async def auto_save():
	while True:
		await asyncio.sleep(600)
		cache.save_to(cache_file)

async def connect(hostname):
	connections[hostname] = await asyncssh.connect(hostname, username = 'runner', known_hosts = '/etc/ssh/ssh_known_hosts')

async def get_environment(handler_id):
	lock.acquire()
	try:
		if handler_id in hostnames:
			hostname = hostnames[handler_id]
			context = contexts[handler_id]
			active = True
		else:
			hostname = min(pool, key = lambda hostname: pool[hostname] + random.random())
			if not hostname in connections:
				await connect(hostname)
			while True:
				context = 's0-s0:c{},c{},c{},c{}'.format(*sorted(random.sample(range(1024), 4)))
				if context not in contexts.values():
					break
			hostnames[handler_id] = hostname
			contexts[handler_id] = context
			pool[hostname] += 1
			active = False
		lock.release()
		return (hostname, context, active)
	except socket.gaierror:
		pool[hostname] = 1 << 32
		print('Disabled arena "{}".'.format(hostname))
		lock.release()
		raise
	except:
		lock.release()
		raise

async def release_environment(handler_id):
	lock.acquire()
	try:
		hostname = hostnames[handler_id]
	except KeyError:
		lock.release()
		return
	try:
		pool[hostname] -= 1
	except KeyError:
		pass
	try:
		del contexts[handler_id]
	except KeyError:
		pass
	try:
		del hostnames[handler_id]
	except KeyError:
		pass
	lock.release()

async def send_error(websocket, message):
	await websocket.send(zlib.compress(br'/o\ /o\ /o\ /o\ ' + message.encode())[2:-4])

connections = {}
contexts = {}
hostnames = {}
lock = threading.Lock()
pool = {'tio1': 0, 'tio2': 0, 'tio3': 0}

async def consumer(websocket, handler_id):
	while True:
		try:
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
				try:
					await connection.run('killall -Z {0} -INT; sleep 1; killall -Z {0} -KILL'.format(context))
				except:
					pass
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
			break
		except (TypeError, zlib.error):
			await release_environment(handler_id)
			await send_error(websocket, 'The server could not understand the request.')
		except:
			await release_environment(handler_id)
			traceback.print_exc(limit = 1)
			await send_error(websocket, 'Internal server error. Please try again.')

async def handler(websocket, _):
	handler_id = next(counter)
	print('{:012x} {} {}'.format(handler_id, 'CONNECT', websocket.request_headers.get('X-Forwarded-For')))
	_, pending = await asyncio.wait(
		[asyncio.ensure_future(consumer(websocket, handler_id)) for _ in range(2)],
		return_when = asyncio.FIRST_COMPLETED
	)
	for task in pending:
		task.cancel()
	print('{:012x} {}'.format(handler_id, 'CLOSE'))

try:
	cache = tiocache.Cache.load_from(cache_file)
except:
	cache = tiocache.Cache(32, 120 << 20, 128 << 20)

try:
	asyncio.ensure_future(auto_save())
	asyncio.get_event_loop().run_until_complete(websockets.serve(handler, 'localhost', 410))
	asyncio.get_event_loop().run_forever()
except:
	cache.save_to(cache_file)
	raise
