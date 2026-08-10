#!/usr/bin/env bash
echo "=== ERROR CODES (frequency) ==="
grep -oE 'error TS[0-9]+' /tmp/tsc.log | sort | uniq -c | sort -rn
echo
echo "=== SERVER-ONLY error count ==="
grep -E 'error TS' /tmp/tsc.log | grep -cE '^server/'
echo "=== CLIENT-ONLY error count ==="
grep -E 'error TS' /tmp/tsc.log | grep -cE '^(client|src|packages)/'
