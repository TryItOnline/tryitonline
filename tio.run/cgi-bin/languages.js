#!/usr/bin/env bash

printf 'Content-Type: application/javascript\nContent-Encoding: gzip\n\n'
printf 'var languages = %s;\n' "$(<../../tryitonline.net/languages.json)" | gzip


