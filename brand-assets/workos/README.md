# WorkOS Brand Assets

Use these transparent PNG files in WorkOS AuthKit Branding:

- `sagittaiq-logo.png`: upload as **Logo**
- `sagittaiq-logo-icon.png`: upload as **Logo icon**

Both assets exceed WorkOS's minimum 160x160 pixel requirement and remain below
the 100 KB upload limit.

| Asset | Dimensions | Approximate size |
| --- | ---: | ---: |
| `sagittaiq-logo.png` | 1400x400 | 19 KB |
| `sagittaiq-logo-icon.png` | 512x512 | 5 KB |

Regenerate the files from the in-app brand system with:

```powershell
& 'C:\Users\mikal\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\export-workos-brand-assets.py
```
