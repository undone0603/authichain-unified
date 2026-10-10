with open("src/App.tsx", "r") as f:
    content = f.read()

bad = '''verifyAttestationJWS,
AuthIChainAttestationV01,
} from "../../../packages/verifier/src/index";'''

good = '''import {
  verifyAttestationJWS,
  AuthIChainAttestationV01,
} from "../../../packages/verifier/src/index";'''

content = content.replace(bad, good)

with open("src/App.tsx", "w") as f:
    f.write(content)

print("FIXED")
