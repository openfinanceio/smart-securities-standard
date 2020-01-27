#!/bin/bash

# This is a convenience script that starts ganache, then uses the default addresses
# deterministically created by `ganache-cli -d` to instantiate a test environment.

ganache-cli -a 15 -d &
ganachepid="$!"

trap "kill $ganachepid" EXIT

n=0
while ! netstat -tl | grep -q 8545 && [ "$n" -lt 6 ]; do
  n=$((n+1))
  sleep 1
done

if ! netstat -tl | grep -q 8545; then
  >&2 echo "Ganache doesn't seem to be starting up.... Try again."
  exit 1
fi

addresses='0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1
0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0
0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b
0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d
0xd03ea8624C8C5987235048901fB614fDcA89b117'

xargs ./new_instance.sh < <(echo "$addresses")

# Loop until killed
while true; do sleep 600; done

