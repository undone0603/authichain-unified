import httpx
url = 'https://authichain.com/assets/index-BRxg5LyC.css'
r = httpx.get(url)
print(f'Status: {r.status_code}')
print(f'Type: {r.headers.get("Content-Type")}')
print(f'Cache: {r.headers.get("Cache-Control")}')
print(f'X-Vercel-Cache: {r.headers.get("X-Vercel-Cache")}')
print(f'Body: {r.text[:100]}')
