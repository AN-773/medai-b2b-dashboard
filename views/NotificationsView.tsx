import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  BellRing,
  FileText,
  ScrollText,
  Send,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationOverview from '../components/notifications/NotificationOverview';
import DeliveryLogBrowser from '../components/notifications/DeliveryLogBrowser';
import TemplateManager from '../components/notifications/TemplateManager';
import TeamsWebhookManager from '../components/notifications/TeamsWebhookManager';
import SuppressionManager from '../components/notifications/SuppressionManager';
import DeviceTokenBrowser from '../components/notifications/DeviceTokenBrowser';
import TestSendConsole from '../components/notifications/TestSendConsole';

type NotificationTab =
  | 'overview'
  | 'deliveries'
  | 'templates'
  | 'webhooks'
  | 'suppressions'
  | 'devices'
  | 'send';

const TABS: { id: NotificationTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'deliveries', label: 'Delivery Log', icon: ScrollText },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'webhooks', label: 'Teams Webhooks', icon: BellRing },
  { id: 'suppressions', label: 'Suppressions', icon: ShieldAlert },
  { id: 'devices', label: 'Device Tokens', icon: Smartphone },
  { id: 'send', label: 'Send a Test', icon: Send },
];

const NotificationsView: React.FC = () => {
  const { isSuperadmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationTab>('overview');

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

  const tabButtonClass = (tab: NotificationTab) =>
    `w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-emerald-50 text-emerald-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex bg-slate-50 border-b border-slate-200 px-6 py-4 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Notification Service</h2>
          <p className="text-sm text-slate-500 mt-1">
            Inspect deliverability, manage templates and alert destinations, and verify channels
            end to end.
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-slate-50 border-r border-slate-200 p-4 shrink-0 overflow-y-auto hidden md:block">
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={tabButtonClass(tab.id)}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto">
          {/* Mobile tab strip — the rail is hidden below md. */}
          <div className="md:hidden border-b border-slate-200 bg-slate-50 px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">{renderTab()}</div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsView;
