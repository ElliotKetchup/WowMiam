#!/bin/bash
# Five phones at once against the emulator, coordinating through flag files in a temp dir.
HERE=$(cd "$(dirname "$0")" && pwd)
DIR=$(mktemp -d)
RULES="$HERE/../../../app/firestore.rules"
for who in alice bob carol dave alice2; do node "$HERE/out/device.mjs" $who "$DIR" "$RULES" > "$DIR/$who.log" 2>&1 & done
wait
cat "$DIR"/alice.log "$DIR"/bob.log "$DIR"/carol.log "$DIR"/dave.log "$DIR"/alice2.log | grep -E "^\[|ALERT"
[ "$(cat "$DIR"/*-exit | paste -sd+ | bc)" = 0 ]
