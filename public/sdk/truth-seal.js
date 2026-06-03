/**
 * AuthiChain Truth SDK v1.0
 * Universal JavaScript Loader
 */
(function() {
  const STYLE = `
    .authichain-seal {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #000;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .authichain-seal:hover {
      border-color: #fbbf24;
      background: #0a0a0a;
    }
    .authichain-pulse {
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: authichain-glow 2s infinite;
    }
    @keyframes authichain-glow {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    .authichain-text {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .authichain-brand {
      color: #fbbf24;
      margin-right: 4px;
    }
  `;

  function init() {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = STYLE;
    document.head.appendChild(styleTag);

    const elements = document.querySelectorAll('[data-authichain-product-id]');
    elements.forEach(async (el) => {
      const productId = el.getAttribute('data-authichain-product-id');
      try {
        const res = await fetch(`https://authichain.com/api/v1/seal/${productId}`);
        const data = await res.json();
        
        if (data.status === 'VERIFIED') {
          el.innerHTML = `
            <a href="${data.sealUrl}" target="_blank" class="authichain-seal">
              <div class="authichain-pulse"></div>
              <span class="authichain-text">
                <span class="authichain-brand">${data.brand}</span>
                Verified Authentic
              </span>
            </a>
          `;
        }
      } catch (err) {
        console.error('AuthiChain SDK Error:', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
