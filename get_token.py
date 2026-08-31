from pathlib import Path
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_SECRETS_FILE = Path("credentials.json")
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
]

if not CLIENT_SECRETS_FILE.is_file():
    sys.exit(
        "credentials.json is not in the repo. Download an OAuth Desktop client "
        "from Google Cloud into this directory locally and rerun."
    )

flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
creds = flow.run_local_server(port=0)
print(f"Refresh Token: {creds.refresh_token}")
