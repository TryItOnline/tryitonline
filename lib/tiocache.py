from os import fsync, rename, remove
from pympler.asizeof import asizeof
from random import getrandbits
from struct import pack, unpack
from sys import getsizeof
from threading import Lock
from time import time

class Cache:
	__magic = b'\x4C\x83\x82\x69\xC8\x5E'
	__reserved = b'\x00\x00'

	def __drop(self, key):
		value = self.__dict.pop(key)
		self.__mem_inner -= asizeof(key) + asizeof(value)

	def __trim(self):
		self.__lock.acquire()
		try:
			if self.get_mem_usage() > self.__mem_upper:
				for key in sorted(self.__dict, key = self.get_atime):
					self.__drop(key)
					if self.get_mem_usage() <= self.__mem_lower:
						break
			self.__lock.release()
		except:
			self.__lock.release()
			raise

	@classmethod
	def load_from(cls, filename):
		file = open(filename, 'rb')
		magic = file.read(6)
		version = file.read(2)
		keylen, mem_lower, mem_upper, mem_inner = unpack('<QQQQ', file.read(32))
		sep = file.read(8)
		cache = cls(keylen, mem_lower, mem_upper)
		cache.__mem_inner = mem_inner
		cache.__dict = {
			chunk[:keylen]: [*unpack('<d', chunk[keylen : keylen + 8]), chunk[keylen + 8 :]]
			for chunk in file.read().split(sep)
		}
		return cache

	def get_atime(self, key):
		return self.__dict[key][0]

	def get_mem_usage(self):
		return getsizeof(self.__dict) + self.__mem_inner

	def save_to(self, filename):
		self.__lock.acquire()
		try:
			tempfile = '{}.{:8x}'.format(filename, getrandbits(64))
			file = open(tempfile, 'wb')
			while True:
				sep = pack('<Q', getrandbits(64))
				dump = \
					self.__magic + \
					self.__reserved + \
					pack('<QQQQ', self.__keylength, self.__mem_lower, self.__mem_upper, self.__mem_inner) + \
					sep + \
					sep.join(key + pack('d', value[0]) + value[1] for key, value in self.__dict.items())
				if dump.count(sep) == max(len(self.__dict), 1):
					break
			file.write(dump)
			file.flush()
			fsync(file.fileno())
			file.close()
			rename(tempfile, filename)
			self.__lock.release()
		except:
			self.__lock.release()
			try:
				remove(tempfile)
			except FileNotFoundError:
				pass
			raise

	def validate_key(self, key):
		assert type(key) == bytes
		assert len(key) == self.__keylength

	def __delitem__(self, key):
		self.validate_key(key)
		self.__lock.acquire()
		try:
			self.__drop(key)
			self.__lock.release()
		except:
			self.__lock.release()
			raise

	def __init__(self, keylength, mem_lower, mem_upper):
		self.__dict = {}
		self.__lock = Lock()
		self.__keylength = keylength
		self.__mem_lower = mem_lower
		self.__mem_upper = mem_upper
		assert self.__mem_lower <= self.__mem_upper
		self.__mem_inner = asizeof(self) - getsizeof(self.__dict)

	def __iter__(self):
		return iter(self.__dict)

	def __len__(self):
		return len(self.__dict)

	def __getitem__(self, key):
		self.validate_key(key)
		self.__lock.acquire()
		try:
			value = self.__dict[key]
			value[0] = time()
			self.__lock.release()
		except:
			self.__lock.release()
			raise
		return value[1]

	def __setitem__(self, key, value):
		self.validate_key(key)
		value = [time(), value]
		self.__lock.acquire()
		try:
			if key in self.__dict:
				self.__mem_inner -= asizeof(self.__dict[key])
				self.__dict[key] = value
				self.__mem_inner += asizeof(value)
			else:
				self.__dict[key] = value
				self.__mem_inner += asizeof(key) + asizeof(value)
			self.__lock.release()
		except:
			self.__lock.release()
			raise
		self.__trim()
