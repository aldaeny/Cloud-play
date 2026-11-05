import SectionLayout from '../src/components/layout/SectionLayout';
import PrivatePlayer from '../src/components/iptv/PrivatePlayer';

/**
 * Private, owner-only player for the operator's own Xtream subscription.
 *
 * Deliberately NOT linked from the public navigation and marked noindex: the
 * server enforces an owner allow-list on every /api/xtream/* route, so this page
 * is an empty shell for everyone else.
 */
export default function MyTv() {
  return (
    <SectionLayout title={{ ar: 'مشغّلي الخاص', en: 'My private player' }} noIndex>
      {language => <PrivatePlayer language={language} />}
    </SectionLayout>
  );
}
