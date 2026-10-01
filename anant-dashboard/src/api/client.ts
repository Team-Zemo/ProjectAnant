/**
 * API client — typed calls to the Aegon C++ engine (via Bun.js proxy)
 */

const BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

export interface StatusResponse {
  loaded: boolean;
  ingest_running: boolean;
  ingest_pct: number;
  score_pct: number;
  memgraph_ok: boolean;
  rows_loaded: number;
  unique_accounts: number;
  error: string;
}

export interface AccountStats {
  account_id: string;
  bank: string;
  total_in: number;
  total_out: number;
  tx_count: number;
  mule_score: number;
  layer?: number;
  in_degree?: number;
  out_degree?: number;
  has_foreign_ip: boolean;
  has_terminal_marker: boolean;
  has_script_device: boolean;
  transactions?: Transaction[];
}

export interface Transaction {
  txn_id: string;
  sender_account: string;
  receiver_account: string;
  amount: number;
  ts_unix: number;
  payment_mode: string;
  narration?: string;
  foreign_ip?: boolean;
  terminal_marker?: boolean;
  script_device?: boolean;
}

export interface GraphNode {
  "a.id"?: string;
  "n.id"?: string;
  id?: string;
  account_id?: string;
  layer?: number;
  mule_score?: number;
  x?: number;
  y?: number;
  bank?: string;
  in_degree?: number;
  out_degree?: number;
  community_id?: number;
}

export interface GraphEdge {
  "t.txn_id"?: string;
  txn_id?: string;
  from?: string;
  to?: string;
  sender_account?: string;
  receiver_account?: string;
  "a.id"?: string;
  "b.id"?: string;
  "startNode(r).id"?: string;
  "endNode(r).id"?: string;
  amount?: number;
  ts?: number;
  mode?: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceResult {
  victim: string;
  total_in: number;
  total_out: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RiskAccount {
  account_id: string;
  mule_score: number;
  layer?: number;
  in_degree?: number;
  out_degree?: number;
  total_in: number;
  total_out: number;
  tx_count: number;
  bank: string;
  has_foreign_ip: boolean;
  has_terminal_marker: boolean;
  has_script_device: boolean;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => apiFetch<StatusResponse>("/api/status"),

  startIngest: (csvPath?: string) =>
    apiFetch<{ status: string }>("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ path: csvPath }),
    }),

  eventsStream: (onProgress: (pct: number, rows: number) => void) => {
    const es = new EventSource(`${BASE}/api/events`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        onProgress(d.pct ?? 0, d.rows ?? 0);
      } catch {}
    };
    return es;
  },

  snapshot: (max = 300) => apiFetch<GraphSnapshot>(`/api/graph/snapshot?max=${max}`),

  trace: (account_id: string) => apiFetch<TraceResult>(`/api/trace/${encodeURIComponent(account_id)}`),

  account: (id: string) => apiFetch<AccountStats>(`/api/account/${encodeURIComponent(id)}`),

  ring: (account_id: string) => apiFetch<GraphSnapshot>(`/api/graph/ring/${encodeURIComponent(account_id)}`),

  topRisk: (n = 50) => apiFetch<RiskAccount[]>(`/api/top-risk?n=${n}`),

  generateLegal: (account_id: string, type: "fir" | "freeze") =>
    apiFetch<{ pdf_url: string; narrative: string }>("/api/ai/legal", {
      method: "POST",
      body: JSON.stringify({ account_id, type }),
    }),
};
