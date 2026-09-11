"use client";
import { useState } from "react";
import type { AdminUser, AdminRole, Org } from "../../../types";
import { Card, Field, PageTitle, DataTable } from "../../ui";

export default function UserManagementPage({
  users,
  roles,
  orgs,
  onSaved,
  setModal,
}: {
  users: AdminUser[];
  roles: AdminRole[];
  orgs: Org[];
  onSaved: () => Promise<void>;
  setModal: (x: any) => void;
}) {
  const empty = {
    user_id: "",
    username: "",
    password: "",
    employee_number: "",
    employee_name: "",
    position_name: "",
    email: "",
    organization_id: orgs[0]?.organization_id || "",
    is_active: true,
    roles: [] as string[],
  };
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const reset = () => {
    setForm({ ...empty, organization_id: orgs[0]?.organization_id || "" });
    setEditing(false);
    setError("");
  };
  const edit = (u: AdminUser) => {
    setEditing(true);
    setError("");
    setForm({
      user_id: u.user_id,
      username: u.username,
      password: "",
      employee_number: u.employee_number,
      employee_name: u.employee_name,
      position_name: u.position_name || "",
      email: u.email || "",
      organization_id: u.organization_id,
      is_active: u.is_active,
      roles: (u.roles || []).map((r) => r.role_id),
    });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        roles: roles
          .filter((r) => form.roles.includes(r.role_id))
          .map((r) => ({ role_id: r.role_id })),
      };
      if (!editing && !form.password)
        throw new Error("Password wajib diisi untuk akun baru");
      const r = await fetch(
        editing ? `/api/admin/users/${form.user_id}` : "/api/admin/users",
        {
          method: editing ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Gagal menyimpan akun");
      await onSaved();
      setModal({
        type: "success",
        title: "Berhasil",
        message: editing
          ? "Akun pengguna berhasil diperbarui."
          : "Akun pengguna berhasil dibuat.",
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section>
      <PageTitle
        icon="bi-people"
        title="Manajemen Pengguna"
        subtitle="Pembuatan dan pengelolaan akun hanya dapat dilakukan oleh Super Admin."
      />
      <div className="grid-2 admin-users-grid">
        <Card title={editing ? "Edit Akun Pengguna" : "Buat Akun Pengguna"}>
          <form onSubmit={save}>
            <div className="form-row">
              <Field label="Nama Lengkap">
                <input
                  required
                  value={form.employee_name}
                  onChange={(e) =>
                    setForm({ ...form, employee_name: e.target.value })
                  }
                />
              </Field>
              <Field label="NIP / Nomor Pegawai">
                <input
                  required
                  value={form.employee_number}
                  onChange={(e) =>
                    setForm({ ...form, employee_number: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Username">
                <input
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </Field>
              <Field label={editing ? "Password Baru (opsional)" : "Password"}>
                <input
                  type="password"
                  minLength={8}
                  required={!editing}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={
                    editing
                      ? "Kosongkan jika tidak diubah"
                      : "Minimal 8 karakter"
                  }
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Unit Kerja">
                <select
                  required
                  value={form.organization_id}
                  onChange={(e) =>
                    setForm({ ...form, organization_id: e.target.value })
                  }
                >
                  {orgs.map((o) => (
                    <option key={o.organization_id} value={o.organization_id}>
                      {o.organization_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Jabatan">
                <input
                  value={form.position_name}
                  onChange={(e) =>
                    setForm({ ...form, position_name: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <div className="admin-role-picker">
              <span className="field-label">Role Pengguna</span>
              {roles.map((r) => (
                <label key={r.role_id} className="role-check">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(r.role_id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        roles: e.target.checked
                          ? [...form.roles, r.role_id]
                          : form.roles.filter((x: string) => x !== r.role_id),
                      })
                    }
                  />
                  <span>
                    <b>{r.role_name}</b>
                    <small>{r.description || r.role_code}</small>
                  </span>
                </label>
              ))}
            </div>
            <label className="role-check active-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              <span>
                <b>Akun aktif</b>
                <small>Pengguna dapat login jika akun aktif.</small>
              </span>
            </label>
            {error && (
              <div className="login-error">
                <i className="bi bi-exclamation-circle" /> {error}
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <i className="bi bi-arrow-repeat spin" /> Menyimpan…
                  </>
                ) : editing ? (
                  "Simpan Perubahan"
                ) : (
                  "Buat Akun"
                )}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={reset}
                  disabled={saving}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
        </Card>
        <Card title={`Daftar Pengguna (${users.length})`}>
          <DataTable
            headers={[
              "Pengguna",
              "Username",
              "Unit Kerja",
              "Role",
              "Status",
              "Aksi",
            ]}
            rows={users.map((u) => [
              <div key={u.user_id}>
                <b>{u.employee_name}</b>
                <small className="table-subtext">
                  {u.email || u.employee_number}
                </small>
              </div>,
              u.username,
              u.organization_name,
              (u.roles || []).map((r) => r.role_name).join(", "),
              u.is_active ? (
                <span className="status-pill status-approved">Aktif</span>
              ) : (
                <span className="status-pill status-rejected">Nonaktif</span>
              ),
              <button
                key={`edit-${u.user_id}`}
                type="button"
                className="btn-icon"
                title="Edit akun"
                onClick={() => edit(u)}
              >
                <i className="bi bi-pencil-square" />
              </button>,
            ])}
          />
        </Card>
      </div>
    </section>
  );
}
