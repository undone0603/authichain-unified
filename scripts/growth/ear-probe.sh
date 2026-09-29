#!/usr/bin/env bash
# Temporary: learn how the stiftung ear battery register can be read. Removed before merge.
set -u
U=https://www.ear-system.de/ear-verzeichnis/battghersteller.jsf
curl -sSL -m 40 -c j.txt -b j.txt -A "Mozilla/5.0" "$U" -o b.html
ACTION=https://www.ear-system.de$(grep -oE 'action="[^"]+"' b.html | head -1 | cut -d'"' -f2)
VS=$(grep -oE 'name="javax.faces.ViewState"[^>]*value="[^"]+"' b.html | grep -oE 'value="[^"]+"' | cut -d'"' -f2)
BTN=$(grep -oE 'name="formId:j_idt[0-9]+" value="Hersteller' b.html | cut -d'"' -f2)
HID=$(grep -oE 'type="hidden" name="formId:j_idt[0-9]+"' b.html | cut -d'"' -f4)
echo "btn=$BTN hid=$HID"
curl -sSL -m 90 -c j.txt -b j.txt -A "Mozilla/5.0" "$ACTION" \
  --data-urlencode "formId=formId" --data-urlencode "formId:herstellername=*" \
  --data-urlencode "formId:registrierungsnummerBattg=" --data-urlencode "formId:marke=" \
  --data-urlencode "formId:batterieart=Gerätebatterien" --data-urlencode "$HID=" \
  --data-urlencode "$BTN=x" --data-urlencode "javax.faces.ViewState=$VS" -o r.html
echo "size $(wc -c < r.html)"
echo "=== th"; grep -oE '<th[^>]*>.{0,200}' r.html | sed -e 's/<[^>]*>/ /g' | head -20
echo "=== rows $(grep -c '<tr' r.html)"; grep -oE '<tr[^>]*>.{0,700}' r.html | sed -e 's/<[^>]*>/|/g' | tr -s '| ' | sed -n 2,6p
echo "=== links/buttons"; grep -oE '<(a|input)[^>]*(csv|CSV|export|sort|j_idt)[^>]*>' r.html | sed -E 's/value="[^"]{40,}"/value="…"/' | head -30
echo "=== text"; sed -e 's/<[^>]*>/ /g' r.html | tr -s ' \t' ' ' | grep -iE 'treffer|ergebnis|seite|fehler|mindestens' | head -10
