from asyncio import TimeoutError, create_subprocess_exec, get_event_loop, sleep, wait_for
from asyncio.subprocess import PIPE
from codecs import decode, encode
from getpass import getuser
from json import dumps, loads
from os import chmod, close, dup2, environ, getpid, kill, listdir, makedirs, mkdir, path, pipe, read, write
from psutil import pids
from shlex import quote
from shutil import rmtree
from signal import SIGKILL, SIGTERM
from time import monotonic
from traceback import format_exc

ENV_FILE = '.env.tio'
CODE_FILE = '.code.tio'
INPUT_FILE = '.input.tio'

CPUSTAT = environ['CPUSTAT']
HOME = '/home'
LANG = environ['LANG']
ROOT = '/'
TEMP = '/tmp'
USER = getuser()

WRAPPER_DIR = '/srv/wrappers'
WRAPPER_LIST = listdir(WRAPPER_DIR)
WRAPPERS = {lang: path.join(WRAPPER_DIR, lang) for lang in WRAPPER_LIST}

MAX_TIMEOUT = 120
MAX_TRUNCATE = 1024**3

SANDBOX_EXECCON = environ['EXECCON']
SANDBOX_FILECON = environ['FSCREATECON']

SANDBOX_ENVIRON = {
	'BASH_ENV': ENV_FILE,
	'HOME': HOME,
	'LANG': LANG,
	'LD_LIBRARY_PATH': '/usr/local/lib64:/usr/local/lib',
	'LD_PRELOAD': 'libstdbuf.so:tiopreload.so',
	'PATH': '/usr/local/bin:/usr/bin',
	'TMP': TEMP,
	'USER': USER,
	'TZ': 'UTC',
	'_STDBUF_E': '0',
	'_STDBUF_I': '0',
	'_STDBUF_O': '0',
}

WORKER_PID = getpid()

from selinux import setexeccon
setexeccon(environ['EXECCON'])
del setexeccon

from selinux import setfscreatecon
setfscreatecon(environ['FSCREATECON'])
del setfscreatecon

mkdir(HOME)
mkdir(TEMP)

chmod(ROOT, 0o500)

class Request:
	loop = get_event_loop()

	def language(self, language):
		self.comm = WRAPPERS[language]

	def set_env_array(self, name):
		try:
			array = [self.request.pop(name)]

		except KeyError:
			array = self.request.pop(name + 's', [])

		self.env_string += f'TIO_{name.upper()}S=({" ".join(map(quote, array))})\n'

	def environment(self):
		self.env = SANDBOX_ENVIRON.copy()
		self.env.update(self.request.pop('environ', {}))
		self.encoding = self.request.pop('encoding', 'utf_8')

		self.env_string = 'unset BASH_ENV\n'
		self.set_env_array('cflag')
		self.set_env_array('option')
		self.set_env_array('arg')
		self.env_string += f'set -- "${{TIO_ARGS[@]}}"\ncat > {INPUT_FILE}\n'
		self.create_file(ENV_FILE, self.env_string)

	def create_file(self, name, spec):
		name = path.join(HOME, name)
		dirname, filename = path.split(name)

		makedirs(dirname, exist_ok=True)

		with open(name, 'xb') as file:
			try:
				content = spec.pop('content', '')

			except (AttributeError, TypeError):
				content, spec = spec, {}

			try:
				encoding = spec.pop('codec')
				content = content.encode('latin_1')
				content = decode(content, encoding)

			except KeyError:
				encoding = spec.pop('encoding', self.encoding)
				content = encode(content, encoding)

			file.write(content)

	def files(self):
		self.input = self.request.pop('input', '').encode()
		files = self.request.pop('files', {})

		if not CODE_FILE in files:
			code = self.request.pop('code', '')
			self.create_file(CODE_FILE, code)

		for name, spec in files.items():
			self.create_file(name, spec)

	def kill(self):
		killed = -1

		while killed:
			killed = 0

			for pid in pids():
				try:
					if pid != WORKER_PID:
						kill(pid, SIGKILL)
						killed += 1

				except (PermissionError, ProcessLookupError):
					pass

	async def co_run(self):
		rt_start = monotonic()
		ut_start, st_start = map(int, open(CPUSTAT).read().split()[3::2])

		self.proc = await create_subprocess_exec(
			self.comm,
			cwd=HOME,
			env=self.env,
			stdin=PIPE,
			pass_fds=self.pipes,
			preexec_fn=self.preexec
		)

		try:
			await wait_for(self.proc.communicate(self.input), timeout=self.timeout)

		except TimeoutError:
			self.status = 'timedout'

			try:
				self.proc.send_signal(SIGTERM)
				await wait_for(self.proc.wait(), timeout=1)

			except TimeoutExpired:
				self.proc.send_signal(SIGKILL)
				await wait_for(self.proc.wait())

		rt_end = monotonic()
		ut_end, st_end = map(int, open(CPUSTAT).read().split()[3::2])

		utime = (ut_end - ut_start) / 1e6
		stime = (st_end - st_start) / 1e6

		self.info = {
			"rtime": round(rt_end - rt_start, 3),
			"utime": round(utime, 3),
			"stime": round(stime, 3),
			"status": self.status or self.proc.returncode,
		}

	def reader(self, fd, name):
		chunk = read(fd, self.truncate)
		self.output[name] += chunk
		self.truncate -= len(chunk)

		if not self.truncate:
			self.status = 'truncated'
			self.proc.send_signal(SIGKILL)

	def preexec(self):
		for proc_fd, (rpipe, wpipe) in self.pipes.items():
			dup2(wpipe, proc_fd)

	def run(self):
		self.timeout = self.request.pop('timeout', 60)
		assert self.timeout <= MAX_TIMEOUT
		self.truncate = self.request.pop('truncate', 65536)
		assert self.truncate <= MAX_TRUNCATE

		redirects = self.request.pop('redirects', ["stdout", "stderr"])
		self.pipes = {}
		self.output = {}
		self.status = None

		for fd, name in enumerate(redirects, 1):
			(rpipe, wpipe) = pipe()
			self.pipes[fd] = rpipe, wpipe
			self.output[name] = bytearray()
			self.loop.add_reader(rpipe, self.reader, rpipe, name)

		self.loop.run_until_complete(self.co_run())
		self.kill()

		for rpipe, wpipe in self.pipes.values():
			self.loop.remove_reader(rpipe)
			close(wpipe)
			close(rpipe)

	def serialize(self):
		response = {"output": {}, "info": self.info}

		for fd, output in self.output.items():
			response['output'][fd] = output.decode(self.encoding)

		self.response = dumps(response)

	def __init__(self, uri, request):
		try:
			self.http_status = 404
			self.language(uri[1:].decode())
			self.http_status = 400
			self.request = loads(request.decode())
			self.environment()
			self.files()
			self.http_status = 500
			self.run()
			self.serialize()
			self.http_status = 200

		except Exception as e:
			self.exception = e
			self.response = dumps(f'{type(e).__name__}: {format_exc()}')

		finally:
			rmtree(HOME, ignore_errors=True)
			assert listdir(HOME) == []

			rmtree(TEMP, ignore_errors=True)
			assert listdir(TEMP) == []
