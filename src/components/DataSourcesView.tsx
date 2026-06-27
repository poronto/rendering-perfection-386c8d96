import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, X, Check, Trash2, FileText, Layers, ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  isWordPress,
  isWPUserLoggedIn,
  getWPAuthLinks,
  listDataSourcesWP,
  connectDataSourceWP,
  disconnectDataSourceWP,
  SUPPORTED_DATA_SOURCE_PROVIDERS,
  SupportedProvider,
  WPDataSource,
} from '@/lib/wp-api';

interface ViewProps { onBackToChat: () => void }

interface Source {
  key: SupportedProvider;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  authLabel: string;
  placeholder: string;
  hint: string;
}

/**
 * v12.5.1 bridge supports exactly two providers and requires credentials.
 * No OAuth start endpoint exists — every source uses an API key/token field.
 */
const CATALOG: Source[] = [
  {
    key: 'notion',
    name: 'Notion',
    description: 'Pages, databases, and content',
    icon: FileText,
    authLabel: 'Notion Authentication',
    placeholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    hint: 'Paste your Notion Internal Integration Token (starts with "secret_"). Create one at notion.so/my-integrations.',
  },
  {
    key: 'jira',
    name: 'Jira',
    description: 'Issues, projects, and sprints',
    icon: Layers,
    authLabel: 'Jira Authentication',
    placeholder: 'you@company.com:ATATT3xFfGF0xxxxxxxx',
    hint: 'Paste "email:api_token". Generate the API token at id.atlassian.com/manage-profile/security/api-tokens.',
  },
];

export function DataSourcesView({ onBackToChat }: ViewProps) {
  const wp = isWordPress();
  const loggedIn = wp ? isWPUserLoggedIn() : true;
  const [tab, setTab] = useState<'connected' | 'available'>('available');
  const [connected, setConnected] = useState<WPDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<Source | null>(null);
  const [label, setLabel] = useState('');
  const [creds, setCreds] = useState('');
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState('');

  const refresh = async () => {
    if (!wp || !loggedIn) return;
    setLoading(true);
    try { setConnected(await listDataSourcesWP()); } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!creds.trim()) {
      setAuthError('Credentials are required for Notion / Jira in this version.');
      return;
    }
    setSaving(true);
    try {
      if (!wp) {
        setAuthError('Live authentication is available in the WordPress plugin where the backend is installed.');
        return;
      }
      try {
        await connectDataSourceWP({ provider: modal.key, label, credentials: creds });
      } catch (err: any) {
        const message = err?.message || 'Failed to connect.';
        setAuthError(message);
        toast.error(message);
        return;
      }
      toast.success(`${modal.name} connected`);
      setModal(null);
      setTab('connected');
      refresh();
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

  // Guest gate — v12.5.1 bridge guard() requires login for every data-source action.
  if (wp && !loggedIn) {
    return (
      <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
        <button
          onClick={onBackToChat}
          className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Chat
        </button>
        <div className="max-w-md w-full rounded-2xl border border-border p-6 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Sign in to connect data sources</h2>
          <p className="text-sm text-muted-foreground">
            Connect Notion or Jira to your account. Log in to get started.
          </p>
          <a
            href={getWPAuthLinks().loginUrl}
            className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <button
        onClick={onBackToChat}
        className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Chat
      </button>

      <div className="w-full max-w-3xl space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Connect Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Notion and Jira are supported in this version. Both use a real API key issued by the provider —
            stored encrypted against your WordPress account.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connected.map((c) => {
                const meta = CATALOG.find((s) => s.key === c.provider);
                const Icon = meta?.icon || KeyRound;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Icon className="w-6 h-6 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {c.label || meta?.name || c.provider}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {meta?.description || c.provider}
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-semibold">
                          {(c.status || 'connected').toUpperCase()}
                        </span>
                      </p>
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
                <div key={s.key} className="flex flex-col gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors min-h-[148px]">
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="w-6 h-6 text-primary shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    <p className="mt-1 text-[11px] text-primary flex items-center gap-1">
                      <KeyRound className="w-3 h-3" /> {s.authLabel}
                    </p>
                  </div>
                  <button
                    onClick={() => openConnect(s)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Connect
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
              Paste the API key issued by {modal.name}. It is stored encrypted (AES-256) against your WordPress
              account and used only to fetch data on your behalf.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Label (optional)</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={modal.name} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">API key / credentials</label>
              <Input
                value={creds}
                onChange={(e) => setCreds(e.target.value)}
                type="password"
                placeholder={modal.placeholder}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">{modal.hint}</p>
            </div>
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
                disabled={saving || !creds.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Authentication'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
