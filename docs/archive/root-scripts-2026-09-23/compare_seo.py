import json

def get_slugs(filename):
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
            return {item['slug'] for item in data if 'slug' in item}
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return set()

main_slugs = get_slugs('content/seo/pages.json')
recovered_slugs = get_slugs('content/seo/pages.json.recovered.json')

print(f"Main slugs: {len(main_slugs)}")
print(f"Recovered slugs: {len(recovered_slugs)}")

missing_in_main = recovered_slugs - main_slugs
print(f"Unique to recovered: {len(missing_in_main)}")
for slug in missing_in_main:
    print(f" - {slug}")

missing_in_recovered = main_slugs - recovered_slugs
print(f"Unique to main: {len(missing_in_recovered)}")
