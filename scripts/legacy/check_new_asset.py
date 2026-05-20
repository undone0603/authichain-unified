import httpx

def check_asset():
    url = 'https://authichain-unified-v2-pnnzjeiw9-authichain-6389s-projects.vercel.app/assets/index-Ahgmjg5Y.js'
    r = httpx.get(url)
    print(f"Status: {r.status_code}")
    print(f"Type: {r.headers.get('Content-Type')}")
    print(f"Body: {r.text[:100]}")

if __name__ == "__main__":
    check_asset()
