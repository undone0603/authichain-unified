#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
export PATH="$(echo "$PATH"|tr ':' '\n'|grep -v /mnt/c/|paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
AUTH="/mnt/c/Users/rac/AppData/Roaming/com.vercel.cli/Data/auth.json"
TOKEN=$(node -e "try{console.log(require('$AUTH').token||'')}catch(e){console.log('')}")
echo "token len: ${#TOKEN}"
PID="prj_avIBQb2HRqlvpHE6VN2N2wBlRdgq"; TEAM="team_PKVRDwUXPRFjmGTM7PZxjNys"
echo "=== GET current protection ==="
curl -s "https://api.vercel.com/v9/projects/$PID?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const p=JSON.parse(s);console.log(JSON.stringify({name:p.name,ssoProtection:p.ssoProtection,passwordProtection:p.passwordProtection,error:p.error}))}catch(e){console.log('parse-fail:',s.slice(0,200))}})"
