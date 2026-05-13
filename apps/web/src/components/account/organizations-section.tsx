import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BuildingIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type AuthOrganization } from "@/lib/api";
import { useAccountUiStore } from "@/lib/ui-store";
import { useAccountWorkflowContext } from "@/lib/account-workflow";

export function AccountOrganizationsSection() {
  const creating = useAccountUiStore((state) => state.creatingOrg);
  const orgName = useAccountUiStore((state) => state.orgName);
  const orgSlug = useAccountUiStore((state) => state.orgSlug);
  const inviteOrgId = useAccountUiStore((state) => state.inviteOrgId);
  const inviteEmail = useAccountUiStore((state) => state.inviteEmail);
  const expandedOrgId = useAccountUiStore((state) => state.expandedOrgId);
  const setCreating = useAccountUiStore((state) => state.setCreatingOrg);
  const setOrgName = useAccountUiStore((state) => state.setOrgName);
  const setOrgSlug = useAccountUiStore((state) => state.setOrgSlug);
  const setInviteOrgId = useAccountUiStore((state) => state.setInviteOrgId);
  const setInviteEmail = useAccountUiStore((state) => state.setInviteEmail);
  const toggleExpandedOrg = useAccountUiStore((state) => state.toggleExpandedOrg);
  const { orgsQuery, createOrgMutation, inviteMutation } = useAccountWorkflowContext();

  const { data: orgs = [], isLoading } = useQuery(orgsQuery);

  function createOrg() {
    if (!orgName.trim() || !orgSlug.trim()) return;
    createOrgMutation.mutate({ name: orgName.trim(), slug: orgSlug.trim() });
  }

  function invite(orgId: string) {
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ orgId, email: inviteEmail.trim() });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Organizations</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <BuildingIcon className="mr-1.5 size-3.5" />
          {creating ? "Cancel" : "New org"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {creating && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">Create organization</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Display name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="slug (e.g. acm)"
                value={orgSlug}
                onChange={(e) =>
                  setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                className="font-mono text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={createOrg}
              disabled={createOrgMutation.isPending || !orgName.trim() || !orgSlug.trim()}
            >
              {createOrgMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not a member of any organizations yet.
          </p>
        ) : (
          <div className="space-y-2">
            {orgs.map((org) => (
              <div key={org.id} className="rounded-md border border-border">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => toggleExpandedOrg(org.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{org.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">@{org.slug}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {org.isVerified && (
                      <Badge variant="secondary" className="text-[10px]">
                        verified
                      </Badge>
                    )}
                    <Link
                      to="/orgs/$slug"
                      params={{ slug: org.slug }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline"
                    >
                      View
                    </Link>
                    {expandedOrgId === org.id ? (
                      <ChevronUpIcon className="size-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                </button>

                {expandedOrgId === org.id && (
                  <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                    <OrgMembersPanel org={org} />

                    {inviteOrgId === org.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="email@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && invite(org.id)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => invite(org.id)}
                          disabled={inviteMutation.isPending}
                        >
                          {inviteMutation.isPending ? "..." : "Invite"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setInviteOrgId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setInviteOrgId(org.id)}>
                        Invite member
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrgMembersPanel({ org }: { org: AuthOrganization }) {
  const { fullOrgQuery, removeMemberMutation } = useAccountWorkflowContext();
  const { data, isLoading } = useQuery(fullOrgQuery(org.id));
  const members = data?.members ?? [];

  return (
    <>
      <p className="text-xs font-semibold text-muted-foreground">Members</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No members found.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0 truncate">{member.user?.name ?? member.userId}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{member.role}</span>
                {member.role !== "owner" && (
                  <button
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeMemberMutation.mutate({
                        orgId: org.id,
                        memberIdOrEmail: member.id,
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
