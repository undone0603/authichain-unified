import httpx

def check_asset():
    url = 'https://authichain.com/assets/index-Qyw0L0hF.js'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        print(f"Type: {r.headers.get('Content-Type')}")
        print(f"Length: {len(r.text)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_asset()
