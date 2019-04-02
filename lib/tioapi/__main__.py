from sys import stderr, stdin, stdout

from requests import Request

stdin = stdin.detach()

while True:
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
	status = request.http_status
	response = request.response
	headers = f'HTTP/1.1 {status}\r\n'
	headers += f'Content-Length: {len(response.encode())}\r\n'

	if status >= 500:
		headers += 'Connection: close\r\n'

	try:
		stdout.write(f'{headers}\r\n{response}')

	except BrokenPipeError:
		if status < 500:
			raise SystemExit('disconnected')

	if status >= 500:
		raise request.exception
