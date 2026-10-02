import type {
  StatusResponse,
  AccountStats,
  Transaction,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
  TraceResult,
  RiskAccount,
  PagedResponse,
  TopRiskParams,
  Syndicate,
  SyndicatesResponse,
  SyndicateDetailResponse,
  SyndicateParams,
} from "../api/client";

export type NavTabId = "overview" | "investigation" | "mules" | "syndicates" | "pipeline" | "system";

export interface NavItem {
  id: NavTabId;
  path: string;
  label: string;
  iconName: string;
  badge?: string | number | null;
  badgeClass?: string;
  description?: string;
}

export type RiskSeverityFilter = "all" | "critical" | "high" | "low";
export type LayerFilter = "all" | "0" | "1" | "2" | "3";

export interface MuleRegistryFilters {
  searchQuery: string;
  layer: LayerFilter;
  severity: RiskSeverityFilter;
  bank: string;
  hasForeignIp?: boolean;
  hasTerminalMarker?: boolean;
  hasScriptDevice?: boolean;
}

export type TraceMode = "trail" | "ring";

export type {
  StatusResponse,
  AccountStats,
  Transaction,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
  TraceResult,
  RiskAccount,
  PagedResponse,
  TopRiskParams,
  Syndicate,
  SyndicatesResponse,
  SyndicateDetailResponse,
  SyndicateParams,
};
