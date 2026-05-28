    try {
      if (!isStandardDomain) {
        const brandRes = await fetch(`${supabaseUrl}/rest/v1/brands?domain=eq.${hostname}&select=id`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const brands = await brandRes.json() as Brand[];
        if (brands && brands.length > 0) {
          _brandId = brands[0].id;
        }
      }
    } catch (e) {
      console.error('Brand fetch failed:', e);
    }

    try {
      const qronRes = await fetch(`${supabaseUrl}/rest/v1/qrons?${qronFilter}&select=*`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      });
      const qrons = await qronRes.json() as QRON[];
      if (qrons && qrons.length > 0) {
        const qron = qrons[0];
        // ... rest of the logic ...
      }
    } catch (e) {
      console.error('QRON fetch failed:', e);
    }
