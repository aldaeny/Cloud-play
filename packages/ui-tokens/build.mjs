#!/usr/bin/env node
/**
 * Cloud Play — universal token compiler.
 *
 * `packages/ui-tokens/tokens.json` is the only source of truth for colour,
 * radius, blur, spacing, type, motion, control metrics and elevation. This
 * script compiles it to:
 *
 *   apps/web/src/styles/tokens.generated.css    → CSS custom properties
 *   mobile/ios/Aether/DesignSystem/CloudPlayTokens.swift
 *   mobile/android/.../designsystem/CloudPlayTokens.kt
 *
 * Run: npm run tokens  (from the repository root)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(resolve(here, 'tokens.json'), 'utf8'));
const header = `/* AUTO-GENERATED from packages/ui-tokens/tokens.json — do not edit by hand. */`;

function write(path, body) {
  const target = resolve(here, '../..', path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body.endsWith('\n') ? body : `${body}\n`);
  return path;
}

/* ------------------------------------------------------------------ CSS ---- */
const cssLine = (name, value) => `  --cp-${name}: ${value};`;
const colorBlock = mode => Object.entries(tokens.color[mode])
  .map(([key, value]) => cssLine(`${mode}-${key}`, value)).join('\n');

const css = `${header}
:root {
  color-scheme: dark;

  /* ---- Colour · dark (reference values; semantic mapping lives in theme.css) ---- */
${colorBlock('dark')}

  /* ---- Colour · light ---- */
${colorBlock('light')}

  /* ---- Radius ---- */
${Object.entries(tokens.radius).map(([k, v]) => cssLine(`radius-${k}`, v)).join('\n')}

  /* ---- Blur / material ---- */
${Object.entries(tokens.blur).map(([k, v]) => cssLine(`blur-${k}`, v)).join('\n')}

  /* ---- Spacing ---- */
${Object.entries(tokens.space).map(([k, v]) => cssLine(`space-${k}`, v)).join('\n')}

  /* ---- Type ---- */
${cssLine('font-arabic', tokens.type['family-arabic'])}
${cssLine('font-latin', tokens.type['family-latin'])}
${Object.entries(tokens.type.size).map(([k, v]) => cssLine(`text-${k}`, v)).join('\n')}
${Object.entries(tokens.type.leading).map(([k, v]) => cssLine(`leading-${k}`, v)).join('\n')}
${Object.entries(tokens.type.weight).map(([k, v]) => cssLine(`weight-${k}`, v)).join('\n')}

  /* ---- Motion ---- */
${Object.entries(tokens.motion.duration).map(([k, v]) => cssLine(`duration-${k}`, v)).join('\n')}
${Object.entries(tokens.motion.easing).map(([k, v]) => cssLine(`ease-${k}`, v)).join('\n')}

  /* ---- Control metrics ---- */
${Object.entries(tokens.control).map(([k, v]) => cssLine(`control-${k}`, v)).join('\n')}

  /* ---- Elevation ---- */
${Object.entries(tokens.elevation).map(([k, v]) => cssLine(`elevation-${k}`, v)).join('\n')}
}
`;

/* ---------------------------------------------------------------- Swift ---- */
const camel = s => {
  const value = s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  // Swift and Kotlin identifiers cannot start with a digit (`2xl` -> `r2xl`).
  return /^[0-9]/.test(value) ? `r${value}` : value;
};
const swiftColor = value => {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return `Color(hex: 0x${hex[1].toUpperCase()})`;
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    return `Color(red: ${(+r / 255).toFixed(3)}, green: ${(+g / 255).toFixed(3)}, blue: ${(+b / 255).toFixed(3)}, opacity: ${a === undefined ? '1' : a})`;
  }
  return 'Color.white';
};
const swiftBlock = mode => Object.entries(tokens.color[mode])
  .map(([key, value]) => `    public static let ${camel(key)} = ${swiftColor(value)}`)
  .join('\n');

const swift = `// AUTO-GENERATED from packages/ui-tokens/tokens.json — do not edit by hand.
import SwiftUI

/// Cloud Play — universal Liquid Glass tokens shared with Web and Android.
public enum CloudPlayTokens {
  public enum Color {
    /// Dark Liquid Glass
${swiftBlock('dark')}

    /// Light Liquid Glass
    public enum Light {
${Object.entries(tokens.color.light).map(([key, value]) => `      public static let ${camel(key)} = ${swiftColor(value)}`).join('\n')}
    }
  }

  public enum Radius {
${Object.entries(tokens.radius).filter(([k]) => k !== 'pill').map(([k, v]) => `    public static let ${camel(k)}: CGFloat = ${parseInt(v, 10)}`).join('\n')}
    public static let pill: CGFloat = 999
  }

  public enum Type {
    public static let arabic = "${tokens.type['family-arabic'].split(',')[0].replace(/'/g, '')}"
    public static let latin = "${tokens.type['family-latin'].split(',')[0].replace(/'/g, '')}"
  }

  public enum Motion {
${Object.entries(tokens.motion.duration).map(([k, v]) => `    public static let ${camel(k)} = ${(parseInt(v, 10) / 1000).toFixed(2)}`).join('\n')}
  }

  public enum Control {
${Object.entries(tokens.control).map(([k, v]) => `    public static let ${camel(k)}: CGFloat = ${parseInt(v, 10)}`).join('\n')}
  }
}

public extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}
`;

/* --------------------------------------------------------------- Kotlin ---- */
const kotlinColor = value => {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return `Color(0xFF${hex[1].toUpperCase()})`;
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    const alpha = Math.round(parseFloat(a ?? '1') * 255).toString(16).toUpperCase().padStart(2, '0');
    return `Color(0x${alpha}${(+r).toString(16).padStart(2, '0').toUpperCase()}${(+g).toString(16).padStart(2, '0').toUpperCase()}${(+b).toString(16).padStart(2, '0').toUpperCase()})`;
  }
  return 'Color.White';
};
const kotlin = `// AUTO-GENERATED from packages/ui-tokens/tokens.json — do not edit by hand.
package com.aether.android.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Cloud Play — universal Liquid Glass tokens shared with Web and iOS. */
object CloudPlayTokens {
    object Dark {
${Object.entries(tokens.color.dark).map(([key, value]) => `        val ${camel(key)} = ${kotlinColor(value)}`).join('\n')}
    }

    object Light {
${Object.entries(tokens.color.light).map(([key, value]) => `        val ${camel(key)} = ${kotlinColor(value)}`).join('\n')}
    }

    object Radius {
${Object.entries(tokens.radius).filter(([k]) => k !== 'pill').map(([k, v]) => `        val ${camel(k)} = ${parseInt(v, 10)}.dp`).join('\n')}
        val pill = 999.dp
    }

    object Motion {
${Object.entries(tokens.motion.duration).map(([k, v]) => `        const val ${camel(k).toUpperCase()} = ${parseInt(v, 10)}`).join('\n')}
    }

    object Control {
${Object.entries(tokens.control).map(([k, v]) => `        val ${camel(k)} = ${parseInt(v, 10)}.dp`).join('\n')}
    }
}
`;

const written = [
  write('apps/web/src/styles/tokens.generated.css', css),
  write('mobile/ios/Aether/DesignSystem/CloudPlayTokens.swift', swift),
  write('mobile/android/app/src/main/java/com/aether/android/designsystem/CloudPlayTokens.kt', kotlin),
];
console.log(`Compiled ${written.length} token targets:\n${written.map(p => `  · ${p}`).join('\n')}`);
