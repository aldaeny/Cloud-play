import SectionLayout from '../src/components/layout/SectionLayout';
import BrandIdentity from '../src/components/brand/BrandIdentity';

/**
 * The identity board.
 *
 * A static, indexable page: the shipped lockup, the palette, the content scenes
 * and the live appearance/language previews. It reads from the same providers as
 * the rest of the site, so what you see here is the product, not a mock.
 */
export default function BrandPage() {
  return (
    <SectionLayout title={{ ar: 'هوية كلاود بلاي', en: 'Cloud Play identity' }}>
      {() => <BrandIdentity />}
    </SectionLayout>
  );
}
