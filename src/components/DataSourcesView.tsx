import { useEffect, useState } from 'react';
import {
  ArrowLeft, Database, Plus, X, Check, Trash2,
  Calendar, Mail, MessageSquare, FileText, Briefcase, Users, Headphones, Layers, BookOpen, Cloud, Server, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  isWordPress, listDataSourcesWP, connectDataSourceWP, disconnectDataSourceWP, WPDataSource,
} from '@/lib/wp-api';

interface ViewProps { onBackToChat: () => void }

interface Source {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  supported?: boolean; // backend (versace22-enqueue.php) currently only stores credentials for notion + jira
}

const CATALOG: Source[] = [
  { key: 'asana',        name: 'Asana',           description: 'Tasks, projects & teams',        icon: Briefcase,     color: 'text-rose-500' },
  { key: 'bigquery',     name: 'BigQuery',        description: 'Run SQL on your warehouse',     icon: Server,        color: 'text-blue-500' },
  { key: 'confluence',   name: 'Confluence',      description: 'Wiki pages and spaces',         icon: BookOpen,      color: 'text-sky-500' },
  { key: 'google_calendar', name: 'Google Calendar', description: 'Events and availability',    icon: Calendar,      color: 'text-emerald-500' },
  { key: 'google_drive', name: 'Google Drive + Gmail', description: 'Docs, sheets & email',     icon: Cloud,         color: 'text-amber-500' },
  { key: 'hubspot',      name: 'HubSpot',         description: 'CRM contacts & deals',          icon: Users,         color: 'text-orange-500' },
  { key: 'intercom',     name: 'Intercom',        description: 'Customer conversations',        icon: Headphones,    color: 'text-indigo-500' },
  { key: 'jira',         name: 'Jira',            description: 'Issues and sprints',            icon: Layers,        color: 'text-blue-600', supported: true },
  { key: 'linear',       name: 'Linear',          description: 'Issues, projects & cycles',     icon: Layers,        color: 'text-violet-500' },
  { key: 'notion',       name: 'Notion',          description: 'Pages & databases',             icon: FileText,      color: 'text-foreground', supported: true },
  { key: 'postgres',     name: 'PostgreSQL',      description: 'Read-only SQL access',          icon: Database,      color: 'text-cyan-600' },
  { key: 'salesforce',   name: 'Salesforce',      description: 'Accounts, leads & opps',        icon: Building2,     color: 'text-sky-600' },
  { key: 'slack',        name: 'Slack',           description: 'Channels & DMs',                icon: MessageSquare, color: 'text-fuchsia-500' },
  { key: 'gmail',        name: 'Gmail',           description: 'Email search & drafts',         icon: Mail,          color: 'text-red-500' },
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

  const refresh = async () => {
    if (!wp) return;
    setLoading(true);
    try { setConnected(await listDataSourcesWP()); } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const connectedKeys = new Set(connected.map((c) => c.provider));
  const available = CATALOG.filter((s) => !connectedKeys.has(s.key));

  const openConnect = (s: Source) => {
    setModal(s);
    setLabel(s.name);
    setCreds('');
  };

  const handleConnect = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (wp) {
        const ok = await connectDataSourceWP({ provider: modal.key, label, credentials: creds });
        if (!ok) { toast.error('Failed to connect'); return; }
      } else {
        // Standalone fallback: keep in local state only
        setConnected((prev) => [
          ...prev,
          { id: 'local_' + Date.now(), provider: modal.key, label: label || modal.name, status: 'connected' },
        ]);
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
          <Database className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Connect Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Token-based connections. Paste an API key/token and we store it encrypted against your account.
            OAuth sign-in (e.g. “Sign in with Google”) is coming separately.
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
              {t === 'available' ? 'Available' : `Connected (${connected.length})`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connected.map((c) => {
                const meta = CATALOG.find((s) => s.key === c.provider);
                const Icon = meta?.icon || Database;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Icon className={`w-6 h-6 ${meta?.color || 'text-foreground'}`} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {available.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                  <Icon className={`w-6 h-6 ${s.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                  </div>
                  <button
                    onClick={() => openConnect(s)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
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
              <h3 className="text-lg font-bold text-foreground">Connect {modal.name}</h3>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste an API key/token for {modal.name}. This does <strong>not</strong> sign you into your {modal.name} account —
              true OAuth sign-in is a separate flow coming later.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Label (optional)</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={modal.name} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">API key / access token</label>
              <Input value={creds} onChange={(e) => setCreds(e.target.value)} type="password" placeholder="Paste credentials" />
              <p className="text-[11px] text-muted-foreground">Stored encrypted against your WordPress account. Leave blank to set up later.</p>
            </div>
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
                {saving ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
