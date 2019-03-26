from codecs import decode, encode
from getpass import getuser
from json import dumps, loads
from os import chmod, environ, getpid, kill, listdir, makedirs, mkdir, path
from psutil import pids
from selinux import getexeccon, getfscreatecon
from shlex import quote
from shutil import rmtree
from signal import SIGKILL
from subprocess import TimeoutExpired, run
from traceback import format_exc

ENV_FILE = '.env.tio'
CODE_FILE = '.code.tio'
INPUT_FILE = '.input.tio'
OUT_FILE = '/var/log/output'
ERR_FILE = '/var/log/debug'

HOME = '/home'
LANG = environ['LANG']
LOGS = '/var/log'
ROOT = '/'
TEMP = '/tmp'
USER = getuser()

WRAPPER_DIR = '/srv/wrappers'
WRAPPER_LIST = listdir(WRAPPER_DIR)
WRAPPERS = {lang: path.join(WRAPPER_DIR, lang) for lang in WRAPPER_LIST}

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

with open(OUT_FILE, 'x'), open(ERR_FILE, 'x') as _:
	# TO DO: check context of created files instead
	assert getfscreatecon() == [0, None]

chmod(LOGS, 0o500)

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
		self.encoding = 'utf_8'

		self.env_string = ''
		self.set_env_array('cflag')
		self.set_env_array('option')
		self.set_env_array('arg')
		self.env_string += 'set -- "${TIO_ARGS[@]}"\n'
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

			if isinstance(content, list):
				content = ''.join(content)

			try:
				encoding = spec.pop('codec')
				content = content.encode('latin_1')
				content = decode(content, encoding)

			except KeyError:
				encoding = spec.pop('encoding', self.encoding)
				content = encode(content, encoding)

			file.write(content)

	def files(self):
		files = self.request.pop('files', {})

		if not CODE_FILE in files:
			code = self.request.pop('code', '')
			self.create_file(CODE_FILE, code)

		if not INPUT_FILE in files:
			input = self.request.pop('input', '')
			self.create_file(INPUT_FILE, input)

		for name, spec in files.items():
			self.create_file(name, spec)

	def run(self):
		with open(OUT_FILE, 'wb') as out, open(ERR_FILE, 'wb') as err:
			# TO DO: check context, timings, stop timed out before killing
			try:
				proc = run(
					self.comm,
					cwd=HOME,
					env=self.env,
					stdout=out,
					stderr=err,
					timeout=60
				)

				status = proc.returncode

			except TimeoutExpired:
				status = 'timeout'

		response = {}

		with open(OUT_FILE, 'r', encoding='latin_1') as out:
			response['output'] = out.read()

		with open(ERR_FILE, 'r', encoding='latin_1') as err:
			response['debug'] = err.read()

		response['status'] = status
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
			self.http_status = 200

		except Exception as e:
			self.exception = e
			self.response = dumps(f'{type(e).__name__}: {format_exc()}')

		finally:
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

			rmtree(HOME, ignore_errors=True)
			assert listdir(HOME) == []

			rmtree(TEMP, ignore_errors=True)
			assert listdir(TEMP) == []
