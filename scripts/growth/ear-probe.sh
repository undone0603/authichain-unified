#!/usr/bin/env bash
# Temporary: learn how the stiftung ear battery register can be read. Removed before merge.
set -u
U=https://www.ear-system.de/ear-verzeichnis/battghersteller.jsf
curl -sSL -m 40 -c j.txt -b j.txt -A "Mozilla/5.0" "$U" -o b.html
echo "size $(wc -c < b.html)"
echo "=== forms/inputs"; grep -oE '<(form|input|select|button|a)[^>]*(id|name)="[^"]*"[^>]*>' b.html | sed -E 's/value="[^"]{40,}"/value="…"/' | head -60
echo "=== options"; grep -oE '<option[^>]*>[^<]*' b.html | head -40
echo "=== table head"; grep -oE '<th[^>]*>.{0,120}' b.html | head -20
echo "=== first rows"; grep -oE '<tr[^>]*>.{0,400}' b.html | sed -n 2,6p
echo "=== text"; sed -e 's/<[^>]*>/ /g' b.html | tr -s ' \t' ' ' | grep -v '^ *$' | sed -n '1,400p' | grep -iE 'export|csv|excel|datum|registr|seit|treffer|ergebnis|WEEE|DE [0-9]' | head -40
