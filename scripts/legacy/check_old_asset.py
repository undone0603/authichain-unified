import httpx

def check_old_asset():
    url = 'https://authichain.com/assets/index-Ahgmjg5Y.js'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        print(f"Type: {r.headers.get('Content-Type')}")
        print(f"Body: {r.text[:50]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_old_asset()
