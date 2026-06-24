import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Database, Plus, X, Check, Trash2,
  Calendar, Mail, MessageSquare, FileText, Briefcase, Users, Headphones, Layers, BookOpen, Cloud, Server, Building2, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  isWordPress,
  listDataSourcesWP,
  connectDataSourceWP,
  disconnectDataSourceWP,
  startDataSourceAuthWP,
  WPDataSource,
} from '@/lib/wp-api';

interface ViewProps { onBackToChat: () => void }

interface Source {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  authProvider: string;
  authLabel: string;
  authMode: 'oauth' | 'credentials';
  badge?: string;
}

const CATALOG: Source[] = [
  { key: 'asana', name: 'Asana', description: 'Tasks, projects, and assignments', icon: Briefcase, authProvider: 'asana', authLabel: 'Asana Authentication', authMode: 'oauth' },
  { key: 'bigquery', name: 'BigQuery', description: 'Google BigQuery datasets and queries', icon: Server, authProvider: 'google', authLabel: 'Google Authentication', authMode: 'oauth' },
  { key: 'confluence', name: 'Confluence', description: 'Pages, spaces, and documentation', icon: BookOpen, authProvider: 'atlassian', authLabel: 'Atlassian Authentication', authMode: 'oauth' },
  { key: 'coworker_bot', name: 'Coworker Bot', description: 'Send messages from inside Slack', icon: MessageSquare, authProvider: 'slack', authLabel: 'Slack Authentication', authMode: 'oauth' },
  { key: 'google_calendar', name: 'Google Calendar', description: 'Events and meeting schedules', icon: Calendar, authProvider: 'google', authLabel: 'Google Authentication', authMode: 'oauth' },
  { key: 'google_drive', name: 'Google Drive + Gmail', description: 'Files, folders, and Gmail', icon: Cloud, authProvider: 'google', authLabel: 'Google Authentication', authMode: 'oauth' },
  { key: 'hubspot_read', name: 'HubSpot (Read)', description: 'Contacts, deals, and activities', icon: Users, authProvider: 'hubspot_read', authLabel: 'HubSpot Authentication', authMode: 'oauth' },
  { key: 'hubspot_write', name: 'HubSpot (Write)', description: 'Create, update, and delete HubSpot records', icon: Users, authProvider: 'hubspot_write', authLabel: 'HubSpot Authentication', authMode: 'oauth' },
  { key: 'intercom', name: 'Intercom', description: 'Conversations, contacts, and help center articles', icon: Headphones, authProvider: 'intercom', authLabel: 'Intercom Authentication', authMode: 'oauth' },
  { key: 'jira', name: 'Jira', description: 'Issues, projects, and sprints', icon: Layers, authProvider: 'atlassian', authLabel: 'Atlassian Authentication', authMode: 'oauth' },
  { key: 'linear', name: 'Linear', description: 'Issues, projects, and cycles', icon: Layers, authProvider: 'linear', authLabel: 'Linear Authentication', authMode: 'oauth' },
  { key: 'notion', name: 'Notion', description: 'Pages, databases, and content', icon: FileText, authProvider: 'notion', authLabel: 'Notion Authentication', authMode: 'oauth' },
  { key: 'postgres', name: 'PostgreSQL', description: 'PostgreSQL database queries', icon: Database, authProvider: 'postgres', authLabel: 'PostgreSQL Authentication', authMode: 'credentials' },
  { key: 'salesforce', name: 'Salesforce', description: 'Customer records and sales data', icon: Building2, authProvider: 'salesforce', authLabel: 'Salesforce Authentication', authMode: 'oauth' },
  { key: 'slack', name: 'Slack', description: 'Messages and channel information', icon: MessageSquare, authProvider: 'slack', authLabel: 'Slack Authentication', authMode: 'oauth' },
  { key: 'gitlab', name: 'Gitlab', description: 'Repositories, issues, and merge requests', icon: Layers, authProvider: 'gitlab', authLabel: 'GitLab Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'ashby', name: 'Ashby', description: 'Candidates, jobs, and interviews', icon: Briefcase, authProvider: 'ashby', authLabel: 'Ashby Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'basecamp', name: 'Basecamp', description: 'Projects, to-dos, and messages', icon: Briefcase, authProvider: 'basecamp', authLabel: 'Basecamp Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'bitbucket', name: 'Bitbucket', description: 'Repositories, commits, and pull requests', icon: Layers, authProvider: 'bitbucket', authLabel: 'Bitbucket Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'clickup', name: 'Clickup', description: 'Tasks, lists, and workspaces', icon: Layers, authProvider: 'clickup', authLabel: 'ClickUp Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'front', name: 'Front', description: 'Customer conversations and shared inboxes', icon: Mail, authProvider: 'front', authLabel: 'Front Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'gong', name: 'Gong', description: 'Call transcripts and meeting summaries', icon: Headphones, authProvider: 'gong', authLabel: 'Gong Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'granola', name: 'Granola', description: 'Call transcripts and summaries', icon: FileText, authProvider: 'granola', authLabel: 'Granola Authentication', authMode: 'credentials', badge: 'Enterprise' },
  { key: 'monday', name: 'Monday.com', description: 'Boards, items, and updates', icon: Layers, authProvider: 'monday', authLabel: 'Monday.com Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'pipedrive', name: 'Pipedrive', description: 'Deals, contacts, and activities', icon: Users, authProvider: 'pipedrive', authLabel: 'Pipedrive Authentication', authMode: 'oauth', badge: 'Enterprise' },
  { key: 'snowflake', name: 'Snowflake', description: 'Database tables and queries', icon: Server, authProvider: 'snowflake', authLabel: 'Snowflake Authentication', authMode: 'credentials', badge: 'Enterprise' },
  { key: 'zendesk', name: 'Zendesk', description: 'Tickets and customer conversations', icon: Headphones, authProvider: 'zendesk', authLabel: 'Zendesk Authentication', authMode: 'oauth', badge: 'Enterprise' },
];


export function DataSourcesView({ onBackToChat }: ViewProps) {
  const wp = isWordPress();
  const [tab, setTab] = useState<'connected' | 'available'>('available');
  const [connected, setConnected] = useState<WPDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<Source | null>(null);
  const [label, setLabel] = useState('');
  const [creds, setCreds] = useState('');
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState('');

  const refresh = async () => {
    if (!wp) return;
    setLoading(true);
    try { setConnected(await listDataSourcesWP()); } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const connectedKeys = useMemo(() => new Set(connected.map((c) => c.provider)), [connected]);
  const available = CATALOG.filter((s) => !connectedKeys.has(s.key));

  const openConnect = (s: Source) => {
    setModal(s);
    setLabel(s.name);
    setCreds('');
    setAuthError('');
  };

  const handleConnect = async () => {
    if (!modal) return;
    setAuthError('');
    setSaving(true);
    try {
      if (wp) {
        try {
          if (modal.authMode === 'oauth') {
            const result = await startDataSourceAuthWP({ provider: modal.key, returnUrl: window.location.href });
            if (!result.auth_url) throw new Error('Authentication URL was not returned by the server.');
            window.location.assign(result.auth_url);
            return;
          }
          await connectDataSourceWP({ provider: modal.key, label, credentials: creds, auth_type: modal.authMode });
        } catch (err: any) {
          const message = err?.message || 'Failed to start authentication';
          setAuthError(message);
          toast.error(message);
          return;
        }
      } else {
        const message = 'Live authentication is available in the WordPress plugin where the OAuth backend is installed.';
        setAuthError(message);
        toast.error(message);
        return;
      }
      toast.success(`${modal.name} connected`);
      setModal(null);
      setTab('connected');
      if (wp) refresh();
    } finally { setSaving(false); }
  };


  const handleDisconnect = async (src: WPDataSource) => {
    if (wp) {
      const ok = await disconnectDataSourceWP(src.id);
      if (!ok) { toast.error('Failed to disconnect'); return; }
    }
    setConnected((prev) => prev.filter((s) => s.id !== src.id));
    toast.success('Disconnected');
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <button
        onClick={onBackToChat}
        className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chat
      </button>

      <div className="w-full max-w-3xl space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Connect Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Individual authentication is required for each source. Users authenticate with the provider directly;
            this screen never asks customers to invent API keys for Gmail, Google Drive, GitHub, or similar accounts.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted w-fit mx-auto">
          {(['available', 'connected'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'available' ? `Available (${available.length})` : `Connected (${connected.length})`}
            </button>
          ))}
        </div>

        {tab === 'connected' ? (
          loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : connected.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No data sources connected yet. Switch to <span className="font-medium text-foreground">Available</span> to add one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connected.map((c) => {
                const meta = CATALOG.find((s) => s.key === c.provider);
                const Icon = meta?.icon || Database;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Icon className="w-6 h-6 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.label || meta?.name || c.provider}</p>
                      <p className="text-xs text-muted-foreground truncate">{meta?.description || c.provider}</p>
                    </div>
                    <button
                      onClick={() => handleDisconnect(c)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Disconnect"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {available.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex flex-col gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors min-h-[148px]">
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="w-6 h-6 text-primary shrink-0" />
                    {s.badge && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    <p className="mt-1 text-[11px] text-primary">{s.authLabel}</p>
                  </div>
                  <button
                    onClick={() => openConnect(s)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Connect
                  </button>
                </div>
              );
            })}

            {available.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                All available sources are connected.
              </p>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{modal.authLabel} Required</h3>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              This source requires live authentication so VERSACE22 ai can access the right {modal.name} data for your account.
              {modal.authMode === 'oauth'
                ? ' Continue to the provider sign-in page to authorize access.'
                : ' Enter the connection credentials supplied by your workspace administrator.'}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Label (optional)</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={modal.name} />
            </div>
            {modal.authMode === 'credentials' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Authentication credentials</label>
                <Input value={creds} onChange={(e) => setCreds(e.target.value)} type="password" placeholder="Paste secure connection credentials" />
                <p className="text-[11px] text-muted-foreground">Stored encrypted against your WordPress account.</p>
              </div>
            )}
            {authError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {authError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Starting…' : modal.authMode === 'oauth' ? `Authenticate with ${modal.authProvider === 'google' ? 'Google' : modal.name}` : 'Save Authentication'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
