#!/usr/bin/env bash

# /usr/bin is needed for -M option (show includes) - it calls sed
export PATH=/opt/cyclone/bin:/opt/cyclone/local/bin:/usr/bin
export LIBRARY_PATH=/opt/cyclone/lib:/opt/cyclone/lib/i486-linux-gnu/4.2

ln -f .code.tio .code.tio.cyc
cyclone "${TIO_CFLAGS[@]}" -o .bin.tio .code.tio.cyc
./.bin.tio "$@" < .input.tio
