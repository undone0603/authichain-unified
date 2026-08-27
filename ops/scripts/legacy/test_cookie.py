import asyncio

try:
    from browser_use import Browser, BrowserConfig
except ImportError:
    import pytest
    pytest.skip(
        "browser_use.BrowserConfig was removed in 0.12+; rewrite using BrowserProfile",
        allow_module_level=True,
    )

from playwright.async_api import Cookie

async def test_cookie():
    browser = Browser(config=BrowserConfig(headless=True))
    context = await browser.new_context()
    
    await context.add_cookies([{
        'name': 'test_cookie',
        'value': '12345',
        'domain': '.example.com',
        'path': '/'
    }])
    
    cookies = await context.cookies()
    print("Injected cookies:", cookies)
    await browser.close()

if __name__ == "__main__":
    asyncio.run(test_cookie())