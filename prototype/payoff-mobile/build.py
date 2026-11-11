"""Build prototype/payoff-mobile/index.html: one self-contained file.

Sources: src/ (the Option Scalper rebuild from the Quick Action Wheel placement
study, with Payoff in slot 7) and ../payoff/src/ (the desktop Payoff engine and
the real Kite data it runs on). Run: python3 prototype/payoff-mobile/build.py
"""
import base64, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, 'src')
ENGINE = os.path.join(D, '..', 'payoff', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()

shell = rd(SRC, '00_shell.html')
css = rd(SRC, '10_css.css') + '\n' + rd(SRC, '15_payoff.css')
engine = '\n'.join(rd(ENGINE, f) for f in ['data.js', 'engine.js', 'payoff.js'])
# the engine files end with a CommonJS export for Node tests; harmless in the browser
js = '\n'.join(rd(SRC, f) for f in ['20_core.js', '30_chart.js', '40_ui.js', '50a_content.js', '50b_geo.js', '50c_render.js', '70_payoff.js', '75_panel.js', '60_app.js'])
# font family names that cannot collide with a system copy
css = css.replace('Inter, system-ui', 'InterQW, Inter, system-ui')
js = js.replace('Roboto, "Roboto Fallback", Arial', 'RobotoQW, Roboto, Arial').replace('Roboto, Arial', 'RobotoQW, Roboto, Arial').replace('Inter, sans-serif', 'InterQW, Inter, sans-serif')
faces = []
for w, f in [(400, 'inter-Regular'), (500, 'inter-Medium'), (600, 'inter-SemiBold'), (700, 'inter-Bold')]:
    faces.append("@font-face{font-family:InterQW;font-style:normal;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % (w, base64.b64encode(open(os.path.join(SRC, 'fonts', f + '.woff2'), 'rb').read()).decode()))
for w, f in [(400, 'roboto-400'), (500, 'roboto-500')]:
    faces.append("@font-face{font-family:RobotoQW;font-style:normal;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % (w, base64.b64encode(open(os.path.join(SRC, 'fonts', f + '.woff2'), 'rb').read()).decode()))
fonts = '/* Inter 4.0 and Roboto, subset to Latin and the rupee sign. SIL Open Font License 1.1 and Apache 2.0. */\n' + '\n'.join(faces)
P = dict(re.findall(r"^\s+(\w+): '(.*?)',$", rd(SRC, '20_core.js'), re.M))


def ic(name, size, sw, vb=24):
    return f'<svg class="ico" width="{size}" height="{size}" viewBox="0 0 {vb} {vb}" stroke-width="{sw}" aria-hidden="true">{P[name]}</svg>'


out = shell.replace('/*CSS*/', css).replace('/*JS*/', engine + '\n' + js).replace('/*FONTS*/', fonts)
out = out.replace('/*ICON_X*/', ic('x', 24, 1.6)).replace('/*ICON_ROT*/', ic('rot', 35, 1.65, 32).replace('<svg ', '<svg style="transform:translate(-1px,-.3px)" ')).replace('/*ICON_AI*/', ic('ai', 24.6, 2.1, 32)).replace('/*ICON_MORE*/', ic('dots3', 21, 2)).replace('/*ICON_DOCK*/', ic('wheel', 22, 1.6))
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'index.html')
open(dst, 'w', encoding='utf-8').write(out)
print('wrote', dst, len(out) // 1024, 'KB')
