import httpx

def check_router():
    url = 'https://authichain.com/assets/index-IYI-i6Ot.css'
    try:
        r = httpx.get(url)
        print(f"Status: {r.status_code}")
        for k, v in r.headers.items():
            print(f"{k}: {v}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_router()
