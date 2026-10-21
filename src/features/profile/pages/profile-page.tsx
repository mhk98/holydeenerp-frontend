import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, MonitorSmartphone, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChangePasswordCard } from '../components/change-password-card';
import { ProfileGeneralCard } from '../components/profile-general-card';
import { LoginHistoryCard, SessionsCard } from '../components/sessions-card';
import { TwoFactorCard } from '../components/two-factor-card';

const TABS = ['general', 'security', 'sessions'] as const;

export default function ProfilePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((x) => x === params.get('tab')) ?? 'general';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
        breadcrumbs={[{ label: t('profile.title') }]}
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="general">
            <UserRound aria-hidden /> {t('profile.tabs.general')}
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound aria-hidden /> {t('profile.tabs.security')}
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <MonitorSmartphone aria-hidden /> {t('profile.tabs.sessions')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <ProfileGeneralCard />
        </TabsContent>
        <TabsContent value="security" className="space-y-4">
          <ChangePasswordCard />
          <TwoFactorCard />
        </TabsContent>
        <TabsContent value="sessions" className="space-y-4">
          <SessionsCard />
          <LoginHistoryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
