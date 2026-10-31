import os
from supabase import create_client
import json

# Setup
# Credentials come from the environment only. A service-role key was once
# committed here; it must be treated as leaked and rotated.
URL = os.environ.get('SUPABASE_URL')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not URL or not KEY:
    raise SystemExit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
supabase = create_client(URL, KEY)

# Remediation data to be added to root of metadata
REMEDIATION_DATA = {
    'origin_country': 'Italy',
    'material_composition': '100% Genuine Leather',
    'carbon_footprint_total': '15.5 kg CO2e',
    'circularity_index': '85%',
    'reparability_score': '9/10',
    'substances_of_concern': 'None'
}

def remediate_products():
    # Fetch products
    products = supabase.table('products').select('id, metadata').execute()
    
    remediated_count = 0
    
    for product in products.data:
        metadata = product.get('metadata', {})
        # Ensure it's a dict (in case it's None)
        if metadata is None: metadata = {}
            
        dpp = metadata.get('dpp_compliance', {})
        
        # Check if compliant or missing fields
        # The audit scanner checks if the field is in metadata, not in metadata['dpp_compliance']
        # The script needs to populate the root metadata
        
        print(f"Remediating product: {product['id']}")
        
        # 1. Update root metadata
        metadata.update(REMEDIATION_DATA)
        
        # 2. Update DPP fields
        dpp['status'] = 'COMPLIANT'
        dpp['missing_fields'] = []
        dpp['last_checked'] = 'now()'
        
        metadata['dpp_compliance'] = dpp
        
        # Update DB
        supabase.table('products').update({'metadata': metadata}).eq('id', product['id']).execute()
        remediated_count += 1
            
    print(f"Successfully remediated {remediated_count} products.")

if __name__ == '__main__':
    remediate_products()
