import httpx

def check_asset():
    url = 'https://authichain-unified-v2.vercel.app/assets/index-Ahgmjg5Y.js'
    try:
        r = httpx.get(url)
        print(f"URL: {url}")
        print(f"Status: {r.status_code}")
        print(f"Content-Type: {r.headers.get('Content-Type')}")
        print(f"Body Start: {r.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_asset()
