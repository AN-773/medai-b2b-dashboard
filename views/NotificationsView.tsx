import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, PageHeader } from '@/components/ui';
import NotificationOverview from '../components/notifications/NotificationOverview';
import DeliveryLogBrowser from '../components/notifications/DeliveryLogBrowser';
import TemplateManager from '../components/notifications/TemplateManager';
import TeamsWebhookManager from '../components/notifications/TeamsWebhookManager';
import SuppressionManager from '../components/notifications/SuppressionManager';
import DeviceTokenBrowser from '../components/notifications/DeviceTokenBrowser';
import TestSendConsole from '../components/notifications/TestSendConsole';
import NotificationTabs, {
  notificationTabId,
} from '../components/notifications/NotificationTabs';
import { useNotificationTabs } from '../components/notifications/navigation';

const PANEL_ID = 'notifications-panel';

const NotificationsView: React.FC = () => {
  const { isSuperadmin } = useAuth();
  const { activeTab, openTab } = useNotificationTabs();
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);

  // Switching sections while scrolled down would otherwise land mid-way
  // through the next one; bring its top back under the sticky tabs.
  useEffect(() => {
    const scroller = document.getElementById('page-scroll');
    const anchor = tabsAnchorRef.current;
    if (!scroller || !anchor) return;
    const offset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0) scroller.scrollTop += offset;
  }, [activeTab]);

  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'deliveries':
        return <DeliveryLogBrowser />;
      case 'templates':
        return <TemplateManager />;
      case 'webhooks':
        return <TeamsWebhookManager />;
      case 'suppressions':
        return <SuppressionManager />;
      case 'devices':
        return <DeviceTokenBrowser />;
      case 'send':
        return <TestSendConsole />;
      case 'overview':
      default:
        return <NotificationOverview />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Inspect deliverability, manage templates and alert destinations, and verify channels end to end."
        actions={
          activeTab !== 'send' ? (
            <Button variant="primary" icon={Send} onClick={() => openTab('send')}>
              Send test
            </Button>
          ) : undefined
        }
      />

      <div ref={tabsAnchorRef} className="mt-5" aria-hidden="true" />
      <NotificationTabs active={activeTab} onSelect={openTab} panelId={PANEL_ID} />

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={notificationTabId(activeTab)}
        className="pt-6"
      >
        {renderTab()}
      </div>
    </div>
  );
};

export default NotificationsView;
