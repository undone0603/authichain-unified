import httpx

def check_css():
    url = 'https://authichain.com/assets/index-IYI-i6Ot.css'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        print(f"Type: {r.headers.get('Content-Type')}")
        print(f"Body Start: {r.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_css()
