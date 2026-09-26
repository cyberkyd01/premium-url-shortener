# Icons

Place PNG icons named `icon16.png`, `icon32.png`, `icon48.png` and `icon128.png` in this folder before loading the
extension (Chrome refuses to load a Manifest V3 extension whose icon files are missing).

Quick placeholder generation with ImageMagick:

```bash
for s in 16 32 48 128; do convert -size ${s}x${s} xc:'#6366f1' -fill white -gravity center -pointsize $((s/2)) -annotate 0 'S' icon$s.png; done
```

Or export your site logo (Admin → Settings → General → Logo) at those sizes.
