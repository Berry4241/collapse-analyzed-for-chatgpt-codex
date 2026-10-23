#!/usr/bin/env python3
"""Independent synthetic Chromium regression tests for v1.6.

Run:
    pip install playwright
    python -m playwright install chromium
    python tests/regression.py

These fixtures cannot prove compatibility with the live ChatGPT DOM.
"""
import asyncio, os, json, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

BASE=Path(__file__).resolve().parents[1]
SCRIPT=(BASE/"collapse.js").read_text(encoding="utf8")
CSS="""<style>
body{margin:0;background:#111;color:white;font:16px Arial}
main{width:800px;padding:20px}
.header,.hdr{display:flex;align-items:center;min-height:28px;gap:8px;cursor:pointer}
.panel{background:#222;padding:10px}.panel[hidden]{display:none}
pre{padding:12px;background:#333;min-height:24px}
.chart{width:440px;height:200px}
</style>"""
def html(x):return f"<!doctype html><html><head>{CSS}</head><body><main>{x}</main></body></html>"
def native(i,open=True):
    st="true" if open else "false"
    hidden="" if open else "hidden"
    return f"""<div class=step id=s{i}>
    <button class=hdr aria-expanded={st}
      onclick="let isOpen=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!isOpen));this.nextElementSibling.hidden=isOpen">Analyzed</button>
    <div class=panel {hidden}><div>Python</div><pre>print({i})</pre><div>STDOUT/STDERR</div><pre>{i}</pre></div></div>"""
def closed(i):
    return f'<div class=step id=s{i}><div class=hdr>Analyzed</div><div class=panel hidden><pre>closed {i}</pre></div></div>'
def stateless(i,active=True):
    handler='onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden"' if active else ''
    return f'<div class=step id=s{i}><div class=hdr {handler}><span>Analyzed</span><span>⌄</span></div><div class=panel><div>Python</div><pre>print({i})</pre></div></div>'

checks=[]
def eq(name,actual,expected):
    ok=(actual==expected)
    checks.append((name,ok,actual,expected))
    print(f"{'PASS' if ok else 'FAIL'} {name}: {actual!r}")
    return ok
async def main():
    async with async_playwright() as p:
        kw={"headless":True,"args":["--no-sandbox"]}
        if os.environ.get("CHROMIUM_PATH"): kw["executable_path"]=os.environ["CHROMIUM_PATH"]
        b=await p.chromium.launch(**kw)
        page=await b.new_page()
        await page.set_content(html(native(1)+native(2,False)+stateless(3)+stateless(4,False)+
                                    '<p id=answer>Final answer remains visible.</p>'))
        r=await page.evaluate(SCRIPT)
        eq("mixed: four labels",r["found"],4)
        eq("mixed: only three open",r["open"],3)
        eq("mixed: three verified closed",r["collapsed"],3)
        eq("mixed: native control and div clicks",r["native"],2)
        eq("mixed: safe visual fallback",r["visual"],1)
        eq("mixed: closed button not opened",await page.locator("#s2 button").get_attribute("aria-expanded"),"false")
        eq("mixed: main answer visible",await page.locator("#answer").is_visible(),True)
        eq("mixed: native panel hidden",await page.locator("#s1 pre").first.is_visible(),False)
        eq("mixed: stateless panel hidden",await page.locator("#s3 pre").is_visible(),False)
        eq("mixed: no-op fallback panel hidden",await page.locator("#s4 pre").is_visible(),False)
        after=await page.evaluate(SCRIPT)
        eq("repeat: collapse count zero",after["collapsed"],0)
        eq("repeat: opens nothing",await page.locator("#s2 button").get_attribute("aria-expanded"),"false")
        eq("repeat: answer stays visible",await page.locator("#answer").is_visible(),True)
        await page.locator("#s1 button").click()
        res=await page.evaluate(SCRIPT)
        eq("one manually reopened: detected one",res["open"],1)
        eq("one manually reopened: collapsed one",res["collapsed"],1)
        eq("another repeat: collapsed zero",(await page.evaluate(SCRIPT))["collapsed"],0)
        # Stateles visually folded section can be manually expanded by clicking the header.
        await page.locator("#s4 .hdr").click()
        eq("visual fold: manual restoration",await page.locator("#s4 pre").is_visible(),True)
        res=await page.evaluate(SCRIPT)
        eq("manual visual restoration: collapsed one",res["collapsed"],1)
        # Actual zero positive evidence, with a code sample in final answer.
        await page.set_content(html(
          '<div class=step id=c><div class=hdr>Analyzed</div><div class=panel hidden><pre>old</pre></div></div>'
          '<p id=paragraph>Run this example:</p><pre id=finalcode>pip install pandas</pre>'
        ))
        r=await page.evaluate(SCRIPT)
        eq("unknown closed: never expands",r["open"],0)
        eq("unknown closed: code answer preserved",await page.locator("#finalcode").is_visible(),True)
        # Native details works
        await page.set_content(html('<details id=d open><summary>Analyzed</summary><div><pre>detail</pre></div></details>'))
        r=await page.evaluate(SCRIPT)
        eq("details: one collapse",r["collapsed"],1)
        eq("details: no longer open",await page.locator("#d").get_attribute("open"),None)
        eq("details: repeat no toggle",(await page.evaluate(SCRIPT))["collapsed"],0)
        # Mixed body paragraph/chart is protected from direct hiding
        await page.set_content(html(
            '<div class=step><div class=hdr id=h>Analyzed</div>'
            '<div class=panel><div>Python</div><pre>print(33)</pre>'
            '<p id=prose>This is an answer paragraph with analysis, not a tool result. '+
            'The code should not make this text disappear under any circumstances. '*5+
            '</p><img id=chart width=300 height=100 src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E"></div></div>'
        ))
        await page.evaluate(SCRIPT)
        eq("mixed media: chart stays visible",await page.locator("#chart").is_visible(),True)
        eq("mixed media: answer prose stays",await page.locator("#prose").is_visible(),True)
        # Screenshot-like separate code/output blocks and another closed label
        await page.set_content(html(
          '<div class=hdr><span>Analyzed</span><span>⌄</span></div>'
          '<div id=code class=codecard><div>Python</div><pre>print(123)</pre></div>'
          '<div id=stdout><div>STDOUT/STDERR</div><pre>123</pre></div>'
          '<div class=hdr><span>Analyzed</span><span>⌄</span></div>'
          '<p id=last>Keep this final answer visible</p>'
        ))
        r=await page.evaluate(SCRIPT)
        eq("separate output: one open",r["open"],1)
        eq("separate output: one verified collapse",r["collapsed"],1)
        eq("separate output: code hidden",await page.locator("#code").is_visible(),False)
        eq("separate output: STDOUT hidden",await page.locator("#stdout").is_visible(),False)
        eq("separate output: final paragraph preserved",await page.locator("#last").is_visible(),True)
        eq("separate output: repeat collapses zero",(await page.evaluate(SCRIPT))["collapsed"],0)
        # Large mixed state count
        n=1000
        await page.set_content(html("".join(native(i,i%5!=0) for i in range(n))))
        t=time.perf_counter()
        r=await page.evaluate(SCRIPT)
        eq("scale: found 1000",r["found"],1000)
        eq("scale: open 800",r["open"],800)
        eq("scale: verified 800",r["collapsed"],800)
        eq("scale: 200 known closed",r["closed"],200)
        eq("scale: no errors",r["errors"],0)
        eq("scale: second click zero",(await page.evaluate(SCRIPT))["collapsed"],0)
        await page.locator("#s1 button").click()
        eq("scale: reopen one, collapse one",(await page.evaluate(SCRIPT))["collapsed"],1)
        print("SCALE_SECONDS",round(time.perf_counter()-t,2))
        # Banner isn't mistaken for code.
        eq("privacy: permissions",set(json.loads((BASE/'manifest.json').read_text())["permissions"]),{"activeTab","scripting"})
        await b.close()
    ok=sum(c[1] for c in checks)
    print(f"\nRESULT: {ok}/{len(checks)} passed")
    if ok!=len(checks):sys.exit(1)

if __name__=="__main__":asyncio.run(main())
