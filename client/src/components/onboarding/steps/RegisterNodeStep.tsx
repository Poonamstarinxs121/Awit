import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Copy, Check, Loader2 } from 'lucide-react';
import { apiPost } from '../../../api/client';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function RegisterNodeStep({ onNext, onSkip }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nodeData, setNodeData] = useState<{ node_id: string; api_key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const registered = useRef(false);

  async function registerNode() {
    setLoading(true);
    setError('');
    try {
      const result = await apiPost<{ node_id: string; api_key: string }>('/v1/nodes/register', {
        name: `Node-${Date.now().toString(36)}`,
      });
      setNodeData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register node');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (!registered.current) {
      registered.current = true;
      registerNode();
    }
  }, []);

  function getEnvSnippet() {
    if (!nodeData) return '';
    return `SQUIDJOB_HUB_URL=https://your-hub-domain.com
SQUIDJOB_NODE_ID=${nodeData.node_id}
SQUIDJOB_API_KEY=${nodeData.api_key}`;
  }

  function handleCopy() {
    navigator.clipboard.writeText(getEnvSnippet()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRetry() {
    setRetrying(true);
    registerNode();
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Register a Node</h1>
        <p className="text-text-secondary mt-2">Connect your first compute node to the Hub</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-5">
        {loading ? (
          <div className="text-center py-8 space-y-3">
            <Loader2 size={32} className="text-brand-accent animate-spin mx-auto" />
            <p className="text-sm text-text-secondary">Generating node credentials...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
              {error}
            </div>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : nodeData ? (
          <div className="space-y-5">
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🖥️</div>
              <h3 className="text-lg font-bold text-text-primary">Node Registered!</h3>
              <p className="text-sm text-text-secondary mt-1">Save the credentials below — the API key won't be shown again.</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-sm text-green-800 font-medium">Node ID: {nodeData.node_id}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-text-primary">.env Configuration</label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-brand-accent hover:text-brand-accent-hover transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre-wrap">
                {getEnvSnippet()}
              </pre>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Important:</span> Save the API key now. It cannot be retrieved after you leave this page.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-800">
                Need help setting up your node? Check the{' '}
                <a
                  href="/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent underline font-medium"
                >
                  Node Setup Documentation
                </a>
                {' '}for detailed instructions.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-4 bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-text-secondary font-medium rounded-full transition-colors"
        >
          Skip for Now
        </button>
        {nodeData && (
          <button
            onClick={onNext}
            className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold rounded-full transition-colors shadow-lg"
          >
            Done — Continue
          </button>
        )}
      </div>
    </div>
  );
}
