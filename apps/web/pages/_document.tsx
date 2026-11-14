import { Html, Head, Main, NextScript } from 'next/document';
import { BOOT_SCRIPT } from '../src/lib/boot';

/**
 * The document opens in Arabic/RTL (the server's reference language) and the
 * boot script corrects language and appearance before the first paint, using
 * the device's stored preferences. React then takes over through AppProviders.
 */
export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#05060A" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
