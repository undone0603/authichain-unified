import httpx

def check_demo():
    url = 'https://authichain.com/demo'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        print(f"Body Start: {r.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_demo()
