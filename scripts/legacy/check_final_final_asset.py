import httpx

def check_asset():
    # Use the aliased URL which should now be functional
    url = 'https://authichain-unified.vercel.app/assets/index-Ahgmjg5Y.js'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        print(f"Type: {r.headers.get('Content-Type')}")
        print(f"Body Start: {r.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_asset()
