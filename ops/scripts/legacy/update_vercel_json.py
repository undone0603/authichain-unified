import pathlib

def update_vercel_json():
    p = pathlib.Path(r'C:\Users\rac\OneDrive\Desktop\authichain-unified\vercel.json')
    content = '''{
  "version": 2,
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/server.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}'''
    p.write_text(content, encoding='utf-8')

if __name__ == "__main__":
    update_vercel_json()
