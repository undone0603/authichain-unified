import httpx
import re

def find_assets():
    url = 'https://authichain.com/'
    try:
        r = httpx.get(url)
        if r.status_code == 200:
            css = re.findall(r'assets/index-[A-Za-z0-9_-]+\.css', r.text)
            js = re.findall(r'assets/index-[A-Za-z0-9_-]+\.js', r.text)
            print(f"CSS: {css}")
            print(f"JS: {js}")
        else:
            print(f"Failed to fetch home page: {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_assets()
