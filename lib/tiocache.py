from pympler.asizeof import asizeof
from random import getrandbits
from struct import pack, unpack
from sys import getsizeof
from threading import Lock
from time import time

class Cache:
	_magic = b'\x4C\x83\x82\x69\xC8\x5E'
	_reserved = b'\x00\x00'

	def _drop(self, key):
		value = self._dict.pop(key)
		self._mem_inner -= asizeof(key) + asizeof(value)

	def _trim(self):
		self._lock.acquire()
		try:
			if self.get_mem_usage() > self._mem_upper:
				for key in sorted(self._dict, key = self.get_atime):
					self._drop(key)
					if self.get_mem_usage() <= self._mem_lower:
						break
			self._lock.release()
		except:
			self._lock.release()
			raise

	@classmethod
	def load_from(cls, filename):
		file = open(filename, 'rb')
		magic = file.read(6)
		version = file.read(2)
		keylen, mem_lower, mem_upper, mem_inner = unpack('<QQQQ', file.read(32))
		sep = file.read(8)
		cache = cls(keylen, mem_lower, mem_upper)
		cache._mem_inner = mem_inner
		cache._dict = {
			chunk[:keylen]: [*unpack('<d', chunk[keylen : keylen + 8]), chunk[keylen + 8 :]]
			for chunk in file.read().split(sep)
		}
		return cache

	def get_atime(self, key):
		return self._dict[key][0]

	def get_mem_usage(self):
		return getsizeof(self._dict) + self._mem_inner

	def save_to(self, filename):
		self._lock.acquire()
		try:
			file = open(filename, 'wb')
			while True:
				sep = pack('<Q', getrandbits(64))
				dump = \
					self._magic + \
					self._reserved + \
					pack('<QQQQ', self._keylength, self._mem_lower, self._mem_upper, self._mem_inner) + \
					sep + \
					sep.join(key + pack('d', value[0]) + value[1] for key, value in self._dict.items())
				if dump.count(sep) == max(len(self._dict), 1):
					break
			file.write(dump)
			self._lock.release()
		except:
			self._lock.release()
			raise

	def validate_key(self, key):
		assert type(key) == bytes
		assert len(key) == self._keylength

	def __delitem__(self, key):
		self.validate_key(key)
		self._lock.acquire()
		try:
			self._drop(key)
			self._lock.release()
		except:
			self._lock.release()
			raise

	def __init__(self, keylength, mem_lower, mem_upper):
		self._dict = {}
		self._lock = Lock()
		self._keylength = keylength
		self._mem_lower = mem_lower
		self._mem_upper = mem_upper
		assert self._mem_lower <= self._mem_upper
		self._mem_inner = asizeof(self) - getsizeof(self._dict)

	def __iter__(self):
		return iter(self._dict)

	def __len__(self):
		return len(self._dict)

	def __getitem__(self, key):
		self.validate_key(key)
		self._lock.acquire()
		try:
			value = self._dict[key]
			value[0] = time()
			self._lock.release()
		except:
			self._lock.release()
			raise
		return value[1]

	def __setitem__(self, key, value):
		self.validate_key(key)
		value = [time(), value]
		self._lock.acquire()
		try:
			if key in self._dict:
				self._mem_inner -= asizeof(self._dict[key])
				self._dict[key] = value
				self._mem_inner += asizeof(value)
			else:
				self._dict[key] = value
				self._mem_inner += asizeof(key) + asizeof(value)
			self._lock.release()
		except:
			self._lock.release()
			raise
		self._trim()
