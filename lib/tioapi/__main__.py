#!/usr/bin/python3 -u

#from json import dumps, loads
from psutil import pids
from os import chdir, chmod, environ, getpid, kill, listdir, makedirs, mkdir, path
from selinux import setexeccon, setfscreatecon
#from shlex import quote
from shutil import rmtree
from signal import SIGKILL
#from subprocess import DEVNULL, TimeoutExpired, run
from sys import stderr, stdin, stdout

from requests import Request

def cleanup():
	killed = -1
	master = getpid()

	while killed:
		killed = 0

		for pid in pids():
			try:
				if pid != master:
					kill(pid, SIGKILL)
					killed += 1

			except (PermissionError, ProcessLookupError):
				pass

	chmod('/', 0o700)

	if path.exists(home):
		rmtree(home)

	if path.exists(temp):
		rmtree(temp)

	mkdir(home)
	mkdir(temp)

	chmod('/', 0o500)
	chdir('/home')

def send(status, response):
	headers = f'HTTP/1.1 {status}\r\n'

	if status >= 500:
		headers += 'Connection: close\r\n'

	headers += f'Content-Length: {len(response.encode())}\r\n'

	try:
		stdout.write(f'{headers}\r\n{response}')

	except BrokenPipeError:
		if status < 500:
			raise SystemExit('disconnected')

setexeccon(environ['EXECCON'])

home, temp = environ['TIO_HOME'], environ['TIO_TMP']
outfile, errfile = '/var/log/output', '/var/log/debug'

with open(outfile, 'x'), open(errfile, 'x') as _:
	setfscreatecon(environ['FSCREATECON'])
	chmod('/var/log', 0o500)

stdin = stdin.detach()

while True:
	cleanup()

	try:
		method, uri, protocol = stdin.readline().split()
		assert protocol == b'HTTP/1.1'
		prefix, content_length = stdin.readline().split()
		assert prefix.title() == b'Content-Length:'
		blank = stdin.readline()
		assert blank == b'\r\n'
		request = stdin.read(int(content_length))

	except:
		raise SystemExit('disconnected')

	request = Request(uri, request)
	send(request.http_status, request.response)
