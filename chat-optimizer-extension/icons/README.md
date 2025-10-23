# Extension Icons

You need three icon sizes:
- `icon16.png` (16x16) - For the toolbar
- `icon48.png` (48x48) - For the extension management page
- `icon128.png` (128x128) - For the Chrome Web Store

## Quick Method: Use Online Tool

1. Go to https://www.favicon-generator.org/
2. Upload the `icon.svg` file from this folder
3. Download all sizes
4. Rename them to match the required filenames above
5. Place them in this `icons/` folder

## Alternative: Use ImageMagick

If you have ImageMagick installed:

```bash
# From the icons folder
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

## Alternative: Use Online PNG Placeholder

For now, you can use placeholder images from:
https://via.placeholder.com/16x16/10a37f/ffffff?text=CO
https://via.placeholder.com/48x48/10a37f/ffffff?text=CO
https://via.placeholder.com/128x128/10a37f/ffffff?text=CO

Download these and rename to icon16.png, icon48.png, and icon128.png

## Creating Your Own

The icon should represent:
- Speed/performance (lightning bolt ⚡)
- Chat/messaging (speech bubble 💬)
- Optimization (graphs, charts)

Color scheme:
- Primary: #10a37f (green, matching ChatGPT)
- Background: #1a1a1a (dark)
- Accent: white
