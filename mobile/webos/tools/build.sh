#!/bin/bash
# build.sh — Build webOS app package for Aether
# Usage: ./build.sh

APP_ID="com.aether.webos"
VERSION="1.0.0"
OUTPUT_DIR="../dist"
APP_DIR="../app"

echo "Building Aether webOS app v${VERSION}..."

# Clean output
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Copy app files
cp -r "$APP_DIR" "$OUTPUT_DIR/app"

# Generate appinfo.xml
cat > "$OUTPUT_DIR/appinfo.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<appinfo>
    <id>$APP_ID</id>
    <version>$VERSION</version>
    <type>webapp</type>
    <title>Aether</title>
    <description>منصة VOD/IPTV — Aether Streaming</description>
    <icon>app/assets/icons/icon.png</icon>
    <main>app/index.html</main>
    <category>entertainment</category>
</appinfo>
EOF

echo "✅ Package created at $OUTPUT_DIR"
echo "   App ID: $APP_ID"
echo "   Version: $VERSION"
echo ""
echo "To install on webOS TV:"
echo "  1. Enable developer mode on the TV"
echo "  2. Use the webOS IDE or 'ares' CLI to install"
echo "  3. Run: ares-install --app $OUTPUT_DIR --device <TV_IP>"
