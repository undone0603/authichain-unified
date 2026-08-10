import httpx

def print_home():
    url = 'https://authichain.com/'
    try:
        r = httpx.get(url)
        print(r.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print_home()
