"use client";

type CanFn = (
  moduleName: "planning" | "performance" | "risk" | "monitoring",
) => boolean;

type Props = {
  collapsed: boolean;
  mobileOpen?: boolean;
  active: string;
  openModules: Record<string, boolean>;
  can: CanFn;
  onSelect: (id: string) => void;
  onToggleModule: (key: string) => void;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  isAdmin?: boolean;
};

export default function Sidebar({
  collapsed,
  mobileOpen = false,
  active,
  openModules,
  can,
  onSelect,
  onToggleModule,
  onToggleCollapse,
  onCloseMobile,
  isAdmin = false,
}: Props) {
  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-mobile-head">
        <span>Menu</span>
        <button type="button" onClick={onCloseMobile} aria-label="Tutup menu">
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-copy">
            <b>SIMONIK</b>
            <span>Monitoring Informasi Kinerja KPK</span>
          </div>
        </div>
        <div className="caption">MODUL</div>
      </div>

      <nav className="sidebar-nav" aria-label="Navigasi utama">
        <SideItem
          icon="bi-speedometer2"
          label="Dashboard ROPN"
          active={active === "ropn"}
          collapsed={collapsed}
          onClick={() => onSelect("ropn")}
        />
        <SideItem
          icon="bi-grid-1x2-fill"
          label="Dashboard SIMONIK"
          active={active === "dashboard"}
          collapsed={collapsed}
          onClick={() => onSelect("dashboard")}
        />
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="caption admin-caption">ADMINISTRASI</div>
            )}
            <SideItem
              icon="bi-people-fill"
              label="Manajemen Pengguna"
              active={active === "users"}
              collapsed={collapsed}
              onClick={() => onSelect("users")}
            />
          </>
        )}
        {can("planning") && (
          <Module
            label="Perencanaan Strategis"
            icon="bi-diagram-3"
            open={openModules.planning}
            collapsed={collapsed}
            onToggle={() => onToggleModule("planning")}
            items={[
              ["planning", "Matriks Renstra"],
              ["planning-tor", "TOR & RAB"],
              ["planning-work", "Rencana Kerja"],
            ]}
            active={active}
            onSelect={onSelect}
          />
        )}
        {can("performance") && (
          <Module
            label="Manajemen Kinerja"
            icon="bi-graph-up-arrow"
            open={openModules.performance}
            collapsed={collapsed}
            onToggle={() => onToggleModule("performance")}
            items={[
              ["iku", "Manual IKU"],
              ["pk", "Perjanjian Kinerja"],
              ["output", "Manual Rincian Output & Komponen"],
            ]}
            active={active}
            onSelect={onSelect}
          />
        )}
        {can("risk") && (
          <Module
            label="Manajemen Risiko"
            icon="bi-shield-check"
            open={openModules.risk}
            collapsed={collapsed}
            onToggle={() => onToggleModule("risk")}
            items={[
              // ["risk-dashboard", "Dashboard Risiko"],
              ["context", "Lingkup, Konteks & Kriteria"],
              ["assessment", "Penilaian Risiko"],
              ["iru", "Indikator Risiko Utama"],
              ["treatment", "Perlakuan Risiko"],
            ]}
            active={active}
            onSelect={onSelect}
          />
        )}
        {can("monitoring") && (
          <SideItem
            icon="bi-clipboard2-pulse"
            label="Monitoring & Reviu"
            active={active === "monitoring"}
            collapsed={collapsed}
            onClick={() => onSelect("monitoring")}
          />
        )}
        <SideItem
          icon="bi-person-gear"
          label="Akun Saya"
          active={active === "account"}
          collapsed={collapsed}
          onClick={() => onSelect("account")}
        />
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="side-note">
            <i className="bi bi-info-circle" />
            <div>
              <b>Alur terintegrasi</b>
              <small>Renstra → Kinerja → Risiko → Monev</small>
            </div>
          </div>
        )}
        <button
          className="collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Buka sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Buka sidebar" : "Collapse sidebar"}
        >
          <i
            className={`bi ${collapsed ? "bi-layout-sidebar-inset" : "bi-layout-sidebar"}`}
          />
          <span>{collapsed ? "" : "Collapse sidebar"}</span>
        </button>
      </div>
    </aside>
  );
}

function SideItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav ${active ? "active" : ""} ${collapsed ? "icon-only" : ""}`}
      onClick={onClick}
      title={collapsed ? label : ""}
    >
      <i className={`bi ${icon}`} />
      <span>{label}</span>
    </button>
  );
}

function Module({
  label,
  icon,
  open,
  collapsed,
  onToggle,
  items,
  active,
  onSelect,
}: {
  label: string;
  icon: string;
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  items: string[][];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="module">
      <button
        type="button"
        className={`module-head ${collapsed ? "icon-only" : ""}`}
        onClick={onToggle}
        title={collapsed ? label : ""}
        aria-expanded={open && !collapsed}
      >
        <i className={`bi ${icon}`} />
        <span>{label}</span>
        {!collapsed && (
          <i
            className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"} module-chevron`}
          />
        )}
      </button>
      {open && !collapsed && (
        <div className="submenu is-open">
          {items.map(([id, text]) => (
            <button
              type="button"
              key={id}
              className={`sidebar-submenu-item ${active === id ? "active" : ""}`}
              onClick={() => onSelect(id)}
            >
              <span>{text}</span>
              <i className="bi bi-arrow-right-short" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
