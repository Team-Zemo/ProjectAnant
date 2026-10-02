/**
 * API client — typed calls to the Aegon C++ engine (via Bun.js proxy)
 */

const BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

export interface StatusResponse {
  loaded: boolean;
  ingest_running: boolean;
  ingest_pct: number;
  score_pct: number;
  stage_num?: number;
  stage?: string;
  message?: string;
  elapsed_ms?: number;
  duck_time_ms?: number;
  score_time_ms?: number;
  syn_time_ms?: number;
  graph_time_ms?: number;
  memgraph_ok: boolean;
  rows_loaded: number;
  unique_accounts: number;
  victim_accounts?: number;
  critical_mules?: number;
  syndicates_count?: number;
  error: string;
}

export interface IngestProgressEvent {
  pct: number;
  stage_num?: number;
  total_stages?: number;
  stage?: string;
  message?: string;
  elapsed_ms?: number;
  duck_time_ms?: number;
  score_time_ms?: number;
  syn_time_ms?: number;
  graph_time_ms?: number;
  rows?: number;
  accounts?: number;
  running?: boolean;
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
  syndicate_id?: string;
  syndicate_role?: string;
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
  syndicate_id?: string;
  syndicate_role?: string;
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
  syndicate_id?: string;
  syndicate_role?: string;
  has_foreign_ip: boolean;
  has_terminal_marker: boolean;
  has_script_device: boolean;
}

export interface Syndicate {
  syndicate_id: string;
  name: string;
  pattern_type: "AGGREGATION_HUB" | "DISPERSAL_TREE" | "WASH_CYCLE" | "MULTI_HOP_CHAIN" | "HYBRID_SYNDICATE" | string;
  member_count: number;
  layer1_count: number;
  layer2_count: number;
  layer3_count: number;
  total_volume: number;
  avg_mule_score: number;
  max_mule_score: number;
  has_foreign_ip: boolean;
  has_script_device: boolean;
  has_terminal_marker: boolean;
  primary_bank: string;
  first_seen: number;
  last_seen: number;
}

export interface SyndicateDetailResponse {
  syndicate: Syndicate;
  members: RiskAccount[];
  edges: GraphEdge[];
}

export type SyndicatesResponse = PagedResponse<Syndicate>;

export interface PagedResponse<T> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  items: T[];
}

export interface TopRiskParams {
  page?: number;
  limit?: number;
  search?: string;
  layer?: number | string;
  min_score?: number;
  max_score?: number;
  foreign_ip?: boolean;
  terminal?: boolean;
  script?: boolean;
  syndicate_id?: string;
}

export interface SyndicateParams {
  page?: number;
  limit?: number;
  search?: string;
  archetype?: string;
}

export interface UploadedFileResponse {
  filename: string;
  path: string;
  size: number;
}

export interface UploadBatchResponse {
  status: string;
  files: UploadedFileResponse[];
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const isFormData = opts?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...headers,
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => apiFetch<StatusResponse>("/api/status"),

  uploadFiles: async (files: File[]): Promise<UploadBatchResponse> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return apiFetch<UploadBatchResponse>("/api/upload", {
      method: "POST",
      body: formData,
    });
  },

  startIngest: (csvPaths?: string[] | string) => {
    let bodyPayload: any = {};
    if (Array.isArray(csvPaths)) {
      bodyPayload = { paths: csvPaths };
    } else if (typeof csvPaths === "string" && csvPaths.trim()) {
      bodyPayload = { path: csvPaths.trim() };
    }
    return apiFetch<{ status: string }>("/api/ingest", {
      method: "POST",
      body: JSON.stringify(bodyPayload),
    });
  },

  deleteUploadedFile: (filenameOrPath: { filename?: string; path?: string }) =>
    apiFetch<{ status: string; removed: boolean }>("/api/upload/delete", {
      method: "POST",
      body: JSON.stringify(filenameOrPath),
    }),

  resetDatabase: () =>
    apiFetch<{ status: string; message: string }>("/api/reset", {
      method: "POST",
    }),

  eventsStream: (onProgress: (event: IngestProgressEvent) => void) => {
    const es = new EventSource(`${BASE}/api/events`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        onProgress(d);
      } catch {}
    };
    return es;
  },

  trace: (account_id: string) => apiFetch<TraceResult>(`/api/trace/${encodeURIComponent(account_id)}`),

  account: (id: string) => apiFetch<AccountStats>(`/api/account/${encodeURIComponent(id)}`),

  ring: (account_id: string) => apiFetch<GraphSnapshot>(`/api/graph/ring/${encodeURIComponent(account_id)}`),

  syndicates: async (params?: SyndicateParams): Promise<PagedResponse<Syndicate>> => {
    let query = "";
    if (params) {
      const sp = new URLSearchParams();
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      if (params.search && params.search.trim()) sp.set("search", params.search.trim());
      if (params.archetype && params.archetype !== "all") sp.set("archetype", params.archetype);
      const qs = sp.toString();
      if (qs) query = `?${qs}`;
    }
    return apiFetch<PagedResponse<Syndicate>>(`/api/syndicates${query}`);
  },

  syndicate: (id: string) => apiFetch<SyndicateDetailResponse>(`/api/syndicates/${encodeURIComponent(id)}`),

  detectSyndicates: () => apiFetch<{ status: string }>("/api/syndicates/detect", { method: "POST" }),

  topRisk: async (params?: number | TopRiskParams): Promise<PagedResponse<RiskAccount>> => {
    let query = "";
    if (typeof params === "number") {
      query = `?limit=${params}&page=1`;
    } else if (params) {
      const sp = new URLSearchParams();
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      if (params.search && params.search.trim()) sp.set("search", params.search.trim());
      if (params.layer && params.layer !== "all") sp.set("layer", String(params.layer));
      if (params.min_score !== undefined) sp.set("min_score", String(params.min_score));
      if (params.max_score !== undefined) sp.set("max_score", String(params.max_score));
      if (params.foreign_ip) sp.set("foreign_ip", "true");
      if (params.terminal) sp.set("terminal", "true");
      if (params.script) sp.set("script", "true");
      if (params.syndicate_id) sp.set("syndicate_id", params.syndicate_id);
      const qs = sp.toString();
      if (qs) query = `?${qs}`;
    }
    const res = await apiFetch<any>(`/api/top-risk${query}`);
    if (Array.isArray(res)) {
      return {
        total: res.length,
        page: 1,
        limit: res.length,
        total_pages: 1,
        items: res,
      };
    }
    return res as PagedResponse<RiskAccount>;
  },
};
