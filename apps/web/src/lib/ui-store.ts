import { create } from "zustand";
import type { SelectedOp } from "./openapi-types";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeUiState {
  theme: Theme;
  systemTheme: ResolvedTheme;
  hydrated: boolean;
  setTheme: (theme: Theme) => void;
  setSystemTheme: (systemTheme: ResolvedTheme) => void;
  hydrateTheme: (theme: Theme, systemTheme: ResolvedTheme) => void;
}

export const useThemeUiStore = create<ThemeUiState>((set) => ({
  theme: "system",
  systemTheme: "light",
  hydrated: false,
  setTheme: (theme) => set({ theme }),
  setSystemTheme: (systemTheme) => set({ systemTheme }),
  hydrateTheme: (theme, systemTheme) => set({ theme, systemTheme, hydrated: true }),
}));

interface AdminUiState {
  templateFilter: string;
  orgFilter: string;
  setTemplateFilter: (value: string) => void;
  setOrgFilter: (value: string) => void;
}

export const useAdminUiStore = create<AdminUiState>((set) => ({
  templateFilter: "",
  orgFilter: "",
  setTemplateFilter: (templateFilter) => set({ templateFilter }),
  setOrgFilter: (orgFilter) => set({ orgFilter }),
}));

interface DocsUiState {
  selectedOperation: SelectedOp | null;
  setSelectedOperation: (operation: SelectedOp | null) => void;
}

export const useDocsUiStore = create<DocsUiState>((set) => ({
  selectedOperation: null,
  setSelectedOperation: (selectedOperation) => set({ selectedOperation }),
}));

interface AccountUiState {
  keyName: string;
  newKey: string | null;
  copied: boolean;
  creatingOrg: boolean;
  orgName: string;
  orgSlug: string;
  inviteOrgId: string | null;
  inviteEmail: string;
  expandedOrgId: string | null;
  setKeyName: (keyName: string) => void;
  setNewKey: (newKey: string | null) => void;
  setCopied: (copied: boolean) => void;
  setCreatingOrg: (creatingOrg: boolean) => void;
  setOrgName: (orgName: string) => void;
  setOrgSlug: (orgSlug: string) => void;
  setInviteOrgId: (inviteOrgId: string | null) => void;
  setInviteEmail: (inviteEmail: string) => void;
  toggleExpandedOrg: (orgId: string) => void;
  resetOrgForm: () => void;
  resetInviteForm: () => void;
}

export const useAccountUiStore = create<AccountUiState>((set) => ({
  keyName: "",
  newKey: null,
  copied: false,
  creatingOrg: false,
  orgName: "",
  orgSlug: "",
  inviteOrgId: null,
  inviteEmail: "",
  expandedOrgId: null,
  setKeyName: (keyName) => set({ keyName }),
  setNewKey: (newKey) => set({ newKey }),
  setCopied: (copied) => set({ copied }),
  setCreatingOrg: (creatingOrg) => set({ creatingOrg }),
  setOrgName: (orgName) => set({ orgName }),
  setOrgSlug: (orgSlug) => set({ orgSlug }),
  setInviteOrgId: (inviteOrgId) => set({ inviteOrgId }),
  setInviteEmail: (inviteEmail) => set({ inviteEmail }),
  toggleExpandedOrg: (orgId) =>
    set((state) => ({ expandedOrgId: state.expandedOrgId === orgId ? null : orgId })),
  resetOrgForm: () => set({ orgName: "", orgSlug: "", creatingOrg: false }),
  resetInviteForm: () => set({ inviteEmail: "", inviteOrgId: null }),
}));
