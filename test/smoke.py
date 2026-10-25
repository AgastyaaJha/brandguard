"""Headless browser smoke test. Usage: python3 test/smoke.py"""
import sys, os
from playwright.sync_api import sync_playwright
path = 'file://' + os.path.abspath('dist/standalone.html')
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium') if os.path.exists('/opt/pw-browsers/chromium') else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.on('pageerror', lambda e: errs.append('pageerror: %s' % e))
    pg.on('console', lambda m: errs.append('console: %s' % m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'local resource' not in m.text else None)
    pg.goto(path)
    assert pg.locator('.item').count() == 6, 'queue shows 6 items'
    pg.click('.item:has-text("Winter launch")')
    assert pg.locator('.f').count() >= 8, 'findings rendered'
    assert pg.locator('mark.m').count() >= 8, 'highlights rendered'
    before = pg.locator('.f').count()
    pg.click('.f:has-text("customer") >> text=Change to', timeout=3000) if pg.locator('.f:has-text("Change to")').count() else None
    pg.locator('[data-act=apply]').first.click()
    assert pg.locator('.toast').count() >= 1
    # submit disabled while blockers exist
    assert pg.locator('[data-act=submit]').is_disabled(), 'submit gated'
    # versions tab shows diff
    pg.click('[data-act=tab][data-t=versions]')
    assert pg.locator('.diff ins, .diff del').count() >= 1, 'diff shown'
    # reviewer waives blocker
    pg.select_option('#who', 'u-daniel')
    pg.click('[data-act=tab][data-t=content]') if pg.locator('[data-act=tab][data-t=content]').count() else None
    assert pg.locator('[data-act=waive]').count() >= 1
    pg.locator('[data-act=waive]').first.click(); pg.fill('#reason', 'Legal approved 2026-10-20'); pg.click('[data-act=confirmdec]')
    # creator cannot see confidential guideline text
    pg.select_option('#who', 'u-priya')
    pg.click('[data-act=nav][data-v=library]')
    assert 'Visible to managers' in pg.inner_text('main')
    pg.click('[data-act=nav][data-v=insights]')
    assert pg.locator('.bar').count() >= 5 and pg.locator('svg').count() >= 1
    pg.select_option('#who', 'u-anita')
    assert 'unclear' in pg.inner_text('main').lower()
    # html item and image item open
    pg.click('[data-act=nav][data-v=queue]'); pg.click('.item:has-text("Spring landing")'); assert pg.locator('.f').count() >= 6
    pg.click('[data-act=nav][data-v=queue]'); pg.click('.item:has-text("Kitchen hero")'); assert pg.locator('.f:has-text("alt text")').count() >= 1
    # full approval flow on newsletter
    pg.select_option('#who', 'u-marcus'); pg.click('[data-act=nav][data-v=queue]'); pg.click('.item:has-text("December newsletter")')
    pg.click('[data-act=withdraw]')
    for _ in range(6):
        btn = pg.locator('[data-act=apply]:not([disabled])')
        if btn.count() == 0: break
        btn.first.click()
    assert pg.locator('.f.major').count() == 0, 'majors cleared by applying fixes'
    pg.click('[data-act=submit]')
    pg.select_option('#who', 'u-anita'); pg.click('[data-act=approve]')
    pg.screenshot(path='dist/shot-review.png', full_page=True)
    pg.click('[data-act=nav][data-v=about]'); assert 'No external AI' in pg.inner_text('main') or 'makes no network' in pg.inner_text('main')
    # phone width: no horizontal scroll
    pg.set_viewport_size({'width': 400, 'height': 800}); pg.click('[data-act=nav][data-v=queue]')
    assert pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no horizontal scroll at 400px'
    pg.click('.item >> nth=0'); assert pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'review screen fits 400px'
    pg.screenshot(path='dist/shot-phone.png')
    b.close()
print('ERRORS:', errs if errs else 'none'); sys.exit(1 if errs else 0)
