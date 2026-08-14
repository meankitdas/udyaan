"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Search, Trash2, UserCog } from "lucide-react";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ManagedUser, ManagedUserPage, Organization, RoleOption } from "@/lib/portal-types";

const PAGE_SIZE = 50;
const MIN_PASSWORD_LENGTH = 10;

type NewUser = {
  full_name: string;
  email: string;
  password: string;
  role_key: string;
  phone: string;
  organization_id: string;
};

const EMPTY_NEW_USER: NewUser = {
  full_name: "",
  email: "",
  password: "",
  role_key: "STUDENT",
  phone: "",
  organization_id: "",
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return body.detail[0]?.msg ?? fallback;
  } catch {
    /* Non-JSON error body; fall through to the generic message. */
  }
  return fallback;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>(EMPTY_NEW_USER);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role_key", roleFilter);

      const response = await apiFetch(`${API_BASE_URL}/owner/users?${params}`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await readError(response, "Could not load users"));
      const data: ManagedUserPage = await response.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [roleRes, orgRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/owner/roles`, { headers: authHeaders() }),
          apiFetch(`${API_BASE_URL}/organizations`, { headers: authHeaders() }),
        ]);
        if (roleRes.ok) setRoles(await roleRes.json());
        if (orgRes.ok) setOrganizations(await orgRes.json());
      } catch {
        /* Filters degrade to free-text search; the table still works. */
      }
    };
    loadReferenceData();
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/owner/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...newUser,
          phone: newUser.phone || null,
          organization_id: newUser.organization_id || null,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not create the user"));
      setNewUser(EMPTY_NEW_USER);
      setShowCreate(false);
      flash("User created.");
      await loadUsers();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (user: ManagedUser, roleKey: string) => {
    if (roleKey === user.role_key) return;
    setError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/owner/users/${user.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role_key: roleKey }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not change the role"));
      setUsers((current) =>
        current.map((row) => (row.id === user.id ? { ...row, role_key: roleKey } : row)),
      );
      flash(`${user.full_name} is now ${roleKey}. Their existing sessions were signed out.`);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const patchUser = async (user: ManagedUser, changes: Partial<ManagedUser>) => {
    setError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/owner/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not update the user"));
      const updated: ManagedUser = await response.json();
      setUsers((current) => current.map((row) => (row.id === user.id ? { ...row, ...updated } : row)));
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const resetPassword = async (user: ManagedUser) => {
    const next = window.prompt(`New password for ${user.full_name} (min ${MIN_PASSWORD_LENGTH} characters)`);
    if (!next) return;
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE_URL}/owner/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ new_password: next }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not set the password"));
      flash(`Password updated for ${user.full_name}.`);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const removeUser = async (user: ManagedUser) => {
    if (!window.confirm(`Permanently delete ${user.full_name}? This cannot be undone.`)) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/owner/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not delete the user"));
      setUsers((current) => current.filter((row) => row.id !== user.id));
      setTotal((current) => Math.max(0, current - 1));
      flash("User deleted.");
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>
            <UserCog size={18} strokeWidth={1.8} aria-hidden /> User Management
          </h3>
          <p style={{ color: "var(--text-light)", margin: "4px 0 0", fontSize: "0.9rem" }}>
            {total} account{total === 1 ? "" : "s"} across the platform
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate((open) => !open)}>
          <Plus size={16} strokeWidth={2} aria-hidden /> New User
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {showCreate && (
        <form className="form-card" onSubmit={handleCreate} style={{ marginBottom: "20px" }}>
          <h4 style={{ marginTop: 0 }}>Create a user</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="form-group">
              <label htmlFor="new-user-name">Full name</label>
              <input
                id="new-user-name"
                className="form-control"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-email">Email</label>
              <input
                id="new-user-email"
                type="email"
                className="form-control"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-password">Temporary password</label>
              <input
                id="new-user-password"
                type="password"
                className="form-control"
                minLength={MIN_PASSWORD_LENGTH}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-role">Role</label>
              <select
                id="new-user-role"
                className="form-control"
                value={newUser.role_key}
                onChange={(e) => setNewUser({ ...newUser, role_key: e.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.role_key} value={role.role_key}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-user-phone">Phone (optional)</label>
              <input
                id="new-user-phone"
                className="form-control"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-org">Organization (optional)</label>
              <select
                id="new-user-org"
                className="form-control"
                value={newUser.organization_id}
                onChange={(e) => setNewUser({ ...newUser, organization_id: e.target.value })}
              >
                <option value="">No organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ textAlign: "right", marginTop: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>{" "}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search
            size={16}
            strokeWidth={1.8}
            aria-hidden
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}
          />
          <input
            className="form-control"
            style={{ paddingLeft: "32px" }}
            placeholder="Search by name, email or ID"
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            aria-label="Search users"
          />
        </div>
        <select
          className="form-control"
          style={{ flex: "0 1 200px" }}
          value={roleFilter}
          onChange={(e) => {
            setPage(0);
            setRoleFilter(e.target.value);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.role_key} value={role.role_key}>
              {role.role_name} ({role.user_count})
            </option>
          ))}
        </select>
        <button className="btn-secondary" onClick={loadUsers} aria-label="Refresh">
          <RefreshCw size={16} strokeWidth={1.8} aria-hidden /> Refresh
        </button>
      </div>

      {loading ? (
        <PortalSkeleton variant="table" rows={6} compact />
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No users match these filters.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Organization</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{user.full_name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-light)" }}>
                      {user.id}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.organization_name || user.organization_id || "—"}</td>
                  <td>
                    <select
                      className="form-control"
                      style={{ minWidth: "150px" }}
                      value={user.role_key ?? ""}
                      onChange={(e) => changeRole(user, e.target.value)}
                      aria-label={`Role for ${user.full_name}`}
                    >
                      {!user.role_key && <option value="">No role</option>}
                      {roles.map((role) => (
                        <option key={role.role_key} value={role.role_key}>
                          {role.role_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}>
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          onChange={(e) => patchUser(user, { is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}>
                        <input
                          type="checkbox"
                          checked={user.is_approved}
                          onChange={(e) => patchUser(user, { is_approved: e.target.checked })}
                        />
                        Approved
                      </label>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="icon-btn"
                      title="Set password"
                      aria-label={`Set password for ${user.full_name}`}
                      onClick={() => resetPassword(user)}
                    >
                      <KeyRound size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                    <button
                      className="icon-btn delete"
                      title="Delete user"
                      aria-label={`Delete ${user.full_name}`}
                      onClick={() => removeUser(user)}
                    >
                      <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "16px" }}>
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ alignSelf: "center", color: "var(--text-light)" }}>
            Page {page + 1} of {lastPage + 1}
          </span>
          <button className="btn-secondary" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
