#!/usr/bin/env bash

printf 'Access-Control-Allow-Origin: *\nContent-Type: application/javascript\nContent-Encoding: gzip\n\n'
printf 'var languages = %s;\n' "$(<../tryitonline.net/languages.json)" | gzip


