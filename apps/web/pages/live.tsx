import SectionLayout from '../src/components/layout/SectionLayout';
import PrivatePlayer from '../src/components/iptv/PrivatePlayer';

export default function LivePage() {
  return (
    <SectionLayout title={{ ar: 'البث المباشر', en: 'Live TV' }}>
      {language => <PrivatePlayer language={language} initialKind="live" />}
    </SectionLayout>
  );
}
