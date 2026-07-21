"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BatteryMedium,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileKey,
  FileSpreadsheet,
  FileText,
  Folder,
  HardDrive,
  KeyRound,
  Leaf,
  LockKeyhole,
  Minus,
  Monitor,
  Network,
  PanelBottom,
  Power,
  RotateCw,
  Search,
  Server,
  ShieldAlert,
  Square,
  Users,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import styles from "./RemoteArchive.module.css";

type Stage = "rdp" | "connecting" | "desktop" | "locked" | "recovery" | "reveal";
type FolderId = "finance" | "governance" | "academics" | "cohort" | "infrastructure" | "legal";
type DocId =
  | "capex"
  | "bank"
  | "exam"
  | "students"
  | "wifi"
  | "board"
  | "variance"
  | "waivers"
  | "cashflow"
  | "minutes"
  | "risklog"
  | "embargo"
  | "curriculum"
  | "rubric"
  | "credits"
  | "ipregister"
  | "weeklylogs"
  | "mentors"
  | "sensorbom"
  | "flightclearance"
  | "scadahandover"
  | "landdiligence"
  | "environment"
  | "privacy";

type ArchiveFolder = {
  id: FolderId;
  name: string;
  owner: string;
  modified: string;
};

type ArchiveDoc = {
  id: DocId;
  folder: FolderId;
  name: string;
  type: string;
  size: string;
  modified: string;
  fragment?: string;
  color: string;
  classification: string;
  owner: string;
  reference: string;
  summary: string;
};

const FOLDERS: ArchiveFolder[] = [
  { id: "finance", name: "01_Finance_&_Procurement", owner: "Programme Finance", modified: "18/07/2026 22:41" },
  { id: "governance", name: "02_Governance_&_Board", owner: "Strategic Projects Office", modified: "16/07/2026 08:22" },
  { id: "academics", name: "03_Academic_Integration", owner: "Office of Academic Planning", modified: "12/07/2026 09:13" },
  { id: "cohort", name: "04_Cohort_Zero", owner: "Field Immersion Cell", modified: "09/07/2026 07:52" },
  { id: "infrastructure", name: "05_Site_&_Infrastructure", owner: "CANOPY Site PMO", modified: "04/07/2026 14:30" },
  { id: "legal", name: "06_Legal_Risk_&_Compliance", owner: "General Counsel", modified: "01/07/2026 23:19" },
];

const DOCS: ArchiveDoc[] = [
  {
    id: "capex",
    folder: "finance",
    name: "CANOPY_Phase2_CAPEX_FINAL.xlsx",
    type: "Microsoft Excel Worksheet",
    size: "684 KB",
    modified: "18/07/2026 22:41",
    fragment: "U",
    color: "#1f8f59",
    classification: "RESTRICTED · FINANCE",
    owner: "Programme Finance Controller",
    reference: "CN-FIN-26-041",
    summary: "Consolidated phase-II capital plan, funding source schedule and cost-centre ledger.",
  },
  {
    id: "bank",
    folder: "finance",
    name: "CANOPY_vendor_bank_register.pdf",
    type: "PDF Document",
    size: "1.8 MB",
    modified: "17/07/2026 16:08",
    fragment: "D",
    color: "#d65050",
    classification: "RESTRICTED · BANKING",
    owner: "Treasury Operations",
    reference: "CN-TRY-26-118",
    summary: "Beneficiary register, masked settlement instructions and milestone release history.",
  },
  { id: "variance", folder: "finance", name: "CANOPY_cost_variance_Q2.xlsx", type: "Microsoft Excel Worksheet", size: "1.2 MB", modified: "16/07/2026 18:05", color: "#1f8f59", classification: "INTERNAL · FINANCE", owner: "Cost Assurance", reference: "CN-CST-26-009", summary: "Budget-versus-actual variance analysis with package forecasts and contingency drawdowns." },
  { id: "waivers", folder: "finance", name: "procurement_waiver_register.docx", type: "Microsoft Word Document", size: "388 KB", modified: "15/07/2026 11:34", color: "#3977d3", classification: "RESTRICTED · PROCUREMENT", owner: "Central Procurement", reference: "CN-PRC-26-022", summary: "Single-source procurement justifications, approvals and post-award controls." },
  { id: "cashflow", folder: "finance", name: "phase2_cashflow_forecast_v11.xlsx", type: "Microsoft Excel Worksheet", size: "906 KB", modified: "14/07/2026 20:47", color: "#1f8f59", classification: "BOARD CONFIDENTIAL", owner: "Group Treasury", reference: "CN-CF-26-011", summary: "Monthly cash requirements, tranche assumptions and committed-versus-uncommitted exposure." },
  {
    id: "exam",
    folder: "academics",
    name: "Sem6_CANOPY_field_problems.docx",
    type: "Microsoft Word Document",
    size: "226 KB",
    modified: "12/07/2026 09:13",
    fragment: "Y",
    color: "#3977d3",
    classification: "ACADEMIC COUNCIL · DRAFT",
    owner: "Assessment Design Cell",
    reference: "CN-ACA-26-031",
    summary: "Cross-school field cases embedded in semester-six applied systems assessments.",
  },
  { id: "curriculum", folder: "academics", name: "CANOPY_curriculum_mapping_v12.xlsx", type: "Microsoft Excel Worksheet", size: "1.6 MB", modified: "11/07/2026 17:12", color: "#1f8f59", classification: "ACADEMIC COUNCIL · WORKING", owner: "Curriculum Integration Office", reference: "CN-ACA-26-026", summary: "Outcome mapping across engineering, sciences, design, commerce and management programmes." },
  { id: "rubric", folder: "academics", name: "field_assessment_rubric_approved.docx", type: "Microsoft Word Document", size: "512 KB", modified: "10/07/2026 13:40", color: "#3977d3", classification: "INTERNAL · FACULTY", owner: "Field Assessment Board", reference: "CN-ACA-26-024", summary: "Credit-bearing field assessment dimensions, evidence standards and moderation rules." },
  { id: "credits", folder: "academics", name: "credit_equivalence_note_AC-47.pdf", type: "PDF Document", size: "742 KB", modified: "08/07/2026 10:26", color: "#d65050", classification: "ACADEMIC COUNCIL · APPROVED", owner: "Registrar", reference: "AC/47/2026", summary: "Approved conversion of verified field immersion hours into elective and project credits." },
  {
    id: "students",
    folder: "cohort",
    name: "CANOPY_cohort_zero_access.csv",
    type: "Comma Separated Values",
    size: "3.2 MB",
    modified: "09/07/2026 07:52",
    fragment: "A",
    color: "#188a70",
    classification: "RESTRICTED · STUDENT RECORD",
    owner: "Field Immersion Cell",
    reference: "CN-COH-00-EXPORT",
    summary: "Redacted cohort-zero access roster, field hours, prototype ownership and mentor status.",
  },
  { id: "ipregister", folder: "cohort", name: "IP_assignment_exception_register.xlsx", type: "Microsoft Excel Worksheet", size: "828 KB", modified: "08/07/2026 21:14", color: "#1f8f59", classification: "PRIVILEGED · IP", owner: "IP & Technology Transfer", reference: "CN-IP-26-014", summary: "Departures from standard institutional IP terms preserving student inventor ownership." },
  { id: "weeklylogs", folder: "cohort", name: "cohort_zero_weekly_field_logs.pdf", type: "PDF Document", size: "8.4 MB", modified: "07/07/2026 19:02", color: "#d65050", classification: "RESTRICTED · PROGRAMME", owner: "Field Operations", reference: "CN-COH-00-WL", summary: "Fourteen-week redacted field diaries, intervention records and prototype evidence." },
  { id: "mentors", folder: "cohort", name: "mentor_allocation_matrix_v6.xlsx", type: "Microsoft Excel Worksheet", size: "664 KB", modified: "06/07/2026 12:29", color: "#1f8f59", classification: "INTERNAL · PROGRAMME", owner: "CANOPY Programme Office", reference: "CN-MTR-26-006", summary: "Cross-disciplinary mentor allocation, capacity, escalation and review calendar." },
  {
    id: "wifi",
    folder: "infrastructure",
    name: "CANOPY_site_networks.txt",
    type: "Text Document",
    size: "4 KB",
    modified: "04/07/2026 14:30",
    fragment: "A",
    color: "#7c68c5",
    classification: "RESTRICTED · NETWORK",
    owner: "Site Technology Operations",
    reference: "CN-NET-26-HO3",
    summary: "Fictional site SSID inventory, segmentation policy and device onboarding controls.",
  },
  { id: "sensorbom", folder: "infrastructure", name: "soil_sensor_BOM_revC.xlsx", type: "Microsoft Excel Worksheet", size: "2.1 MB", modified: "03/07/2026 17:45", color: "#1f8f59", classification: "INTERNAL · ENGINEERING", owner: "Precision Agriculture Lab", reference: "CN-ENG-BOM-17C", summary: "Bill of materials, calibration tolerances, spares and landed-cost analysis for field sensing." },
  { id: "flightclearance", folder: "infrastructure", name: "drone_flight_clearance_pack.pdf", type: "PDF Document", size: "4.7 MB", modified: "03/07/2026 09:18", color: "#d65050", classification: "RESTRICTED · FLIGHT OPS", owner: "Autonomous Systems Cell", reference: "CN-UAS-26-008", summary: "Synthetic geofence, operating windows, pilot roster and risk controls for field mapping." },
  { id: "scadahandover", folder: "infrastructure", name: "bioCNG_SCADA_handover.docx", type: "Microsoft Word Document", size: "1.3 MB", modified: "02/07/2026 16:36", color: "#3977d3", classification: "RESTRICTED · OPERATIONS", owner: "Circular Systems Team", reference: "CN-SCADA-HO-04", summary: "Control philosophy, alarm matrix, acceptance tests and operating handover for the Bio-CNG loop." },
  {
    id: "board",
    folder: "governance",
    name: "CANOPY_board_note_RESTRICTED.pdf",
    type: "PDF Document",
    size: "942 KB",
    modified: "01/07/2026 23:19",
    fragment: "N",
    color: "#d65050",
    classification: "BOARD EYES ONLY",
    owner: "Strategic Projects Committee",
    reference: "SPC/26/071",
    summary: "Board positioning note defining the programme model, embargo and discovery-led intake.",
  },
  { id: "minutes", folder: "governance", name: "CANOPY_steering_minutes_11.pdf", type: "PDF Document", size: "1.1 MB", modified: "15/07/2026 08:22", color: "#d65050", classification: "BOARD CONFIDENTIAL", owner: "Programme Secretariat", reference: "CN-SC-MOM-011", summary: "Detailed steering committee minutes, decision log, dissent notes and action owners." },
  { id: "risklog", folder: "governance", name: "risk_committee_action_log.xlsx", type: "Microsoft Excel Worksheet", size: "744 KB", modified: "13/07/2026 18:48", color: "#1f8f59", classification: "RESTRICTED · RISK", owner: "Enterprise Risk", reference: "CN-RSK-26-016", summary: "Programme risk register with inherent/residual ratings, mitigations and overdue actions." },
  { id: "embargo", folder: "governance", name: "naming_embargo_draft_v4.docx", type: "Microsoft Word Document", size: "294 KB", modified: "12/07/2026 23:02", color: "#3977d3", classification: "PRIVILEGED · COMMUNICATIONS", owner: "Group Communications", reference: "CN-COMMS-26-004", summary: "Embargo protocol preventing disclosure of the public programme identity before intake activation." },
  { id: "landdiligence", folder: "legal", name: "land_due_diligence_summary.pdf", type: "PDF Document", size: "3.6 MB", modified: "30/06/2026 20:12", color: "#d65050", classification: "LEGAL PRIVILEGED", owner: "General Counsel", reference: "CN-LEG-DD-019", summary: "Synthetic title review, encumbrance schedule, access rights and acquisition conditions." },
  { id: "environment", folder: "legal", name: "environmental_clearance_tracker.xlsx", type: "Microsoft Excel Worksheet", size: "1.1 MB", modified: "29/06/2026 11:07", color: "#1f8f59", classification: "RESTRICTED · COMPLIANCE", owner: "Sustainability & Compliance", reference: "CN-ENV-26-021", summary: "Consent, water, waste, biodiversity and commissioning compliance tracker." },
  { id: "privacy", folder: "legal", name: "student_data_privacy_impact_assessment.docx", type: "Microsoft Word Document", size: "588 KB", modified: "28/06/2026 16:52", color: "#3977d3", classification: "LEGAL PRIVILEGED", owner: "Data Protection Office", reference: "DPIA/CN/2026-03", summary: "Privacy impact assessment covering field telemetry, badges, assessment evidence and retention." },
];

const TARGET = "UDYAAN";

function shuffle<T>(source: T[]): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function WindowsMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`${styles.windowsMark} ${small ? styles.windowsMarkSmall : ""}`} aria-hidden>
      <i /><i /><i /><i />
    </span>
  );
}

function FileGlyph({ doc, size = 26 }: { doc: ArchiveDoc; size?: number }) {
  const Icon = doc.id === "capex" || doc.id === "students" ? FileSpreadsheet : doc.id === "wifi" ? FileText : FileKey;
  return <Icon size={size} strokeWidth={1.7} style={{ color: doc.color }} />;
}

function WindowButtons() {
  return (
    <div className={styles.windowButtons} aria-hidden>
      <span><Minus size={14} /></span>
      <span><Square size={11} /></span>
      <span><X size={14} /></span>
    </div>
  );
}

function Taskbar({ clock }: { clock: Date }) {
  return (
    <div className={styles.taskbar}>
      <div className={styles.taskIcons}>
        <button type="button" title="Start" aria-label="Start"><WindowsMark small /></button>
        <button type="button" title="Search" aria-label="Search"><Search size={20} /></button>
        <button type="button" title="Task view" aria-label="Task view"><PanelBottom size={20} /></button>
        <button type="button" className={styles.taskActive} title="File Explorer" aria-label="File Explorer"><Folder size={21} fill="#f3c94f" color="#dcae2f" /></button>
        <button type="button" title="Remote Desktop" aria-label="Remote Desktop"><Monitor size={20} color="#4e88d9" /></button>
      </div>
      <div className={styles.tray}>
        <ChevronUp size={14} />
        <Wifi size={16} />
        <Volume2 size={16} />
        <BatteryMedium size={17} />
        <span>
          <b>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
          <small>{clock.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })}</small>
        </span>
      </div>
    </div>
  );
}

export function RemoteArchive() {
  const [stage, setStage] = useState<Stage>("rdp");
  const [connectionStep, setConnectionStep] = useState(0);
  const [currentFolder, setCurrentFolder] = useState<FolderId | null>(null);
  const [openDoc, setOpenDoc] = useState<DocId | null>(null);
  const [opened, setOpened] = useState<Set<DocId>>(new Set());
  const [triggered, setTriggered] = useState(false);
  const [recoveryEntry, setRecoveryEntry] = useState("");
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [recoveryShake, setRecoveryShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [server, setServer] = useState("JGI-ARCHIVE-02.internal");
  const [user, setUser] = useState("campus\\temporary-user");
  const tiles = useMemo(() => shuffle([..."UDYAANRX"].map((letter, id) => ({ letter, id }))), []);
  const primaryOpenedCount = useMemo(
    () => [...opened].filter((id) => DOCS.find((doc) => doc.id === id)?.fragment).length,
    [opened],
  );
  const currentFolderMeta = currentFolder ? FOLDERS.find((folder) => folder.id === currentFolder) ?? null : null;
  const visibleDocs = currentFolder ? DOCS.filter((doc) => doc.folder === currentFolder) : [];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage !== "connecting") return;
    setConnectionStep(0);
    const timers = [
      window.setTimeout(() => setConnectionStep(1), 480),
      window.setTimeout(() => setConnectionStep(2), 1150),
      window.setTimeout(() => setConnectionStep(3), 1850),
      window.setTimeout(() => setStage("desktop"), 2550),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [stage]);

  useEffect(() => {
    if (stage !== "desktop" || triggered || primaryOpenedCount < 6) return;
    const timer = window.setTimeout(() => {
      setTriggered(true);
      setStage("locked");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [stage, triggered, primaryOpenedCount]);

  const connect = () => {
    if (!server.trim()) return;
    setStage("connecting");
  };

  const openArchiveDoc = (id: DocId) => {
    setOpenDoc(id);
    setOpened((current) => new Set(current).add(id));
  };

  const resetConnection = () => {
    setStage("rdp");
    setCurrentFolder(null);
    setOpenDoc(null);
    setOpened(new Set());
    setTriggered(false);
    setRecoveryEntry("");
    setUsedTiles(new Set());
    setSolved(false);
  };

  const pressRecoveryTile = useCallback((id: number, letter: string) => {
    if (solved || usedTiles.has(id)) return;
    if (letter === TARGET[recoveryEntry.length]) {
      const next = recoveryEntry + letter;
      setRecoveryEntry(next);
      setUsedTiles((current) => new Set(current).add(id));
      if (next === TARGET) {
        setSolved(true);
        window.setTimeout(() => setStage("reveal"), 1400);
      }
      return;
    }
    setRecoveryEntry("");
    setUsedTiles(new Set());
    setRecoveryShake(true);
    window.setTimeout(() => setRecoveryShake(false), 360);
  }, [recoveryEntry, solved, usedTiles]);

  const selected = openDoc ? DOCS.find((doc) => doc.id === openDoc) ?? null : null;
  const progress = Math.min(100, Math.round((primaryOpenedCount / 6) * 100));

  return (
    <main className={styles.shell}>
      <div className={styles.wallpaper} aria-hidden />
      <div className={styles.desktopIcon}>
        <span><Folder size={31} fill="#f3c94f" color="#dcae2f" /></span>
        <small>Shared Archive</small>
      </div>
      <div className={`${styles.desktopIcon} ${styles.desktopIconSecond}`}>
        <span><Monitor size={30} color="#63a0ef" /></span>
        <small>Remote Desktop</small>
      </div>

      {stage === "rdp" && (
        <section className={styles.rdpWindow} aria-label="Remote Desktop Connection">
          <div className={styles.titlebar}>
            <span><Monitor size={16} color="#2768ba" /> Remote Desktop Connection</span>
            <WindowButtons />
          </div>
          <div className={styles.rdpHero}>
            <div className={styles.remoteLogo}><Monitor size={42} strokeWidth={1.35} /><span>→</span><Server size={42} strokeWidth={1.35} /></div>
            <div><strong>Remote Desktop Connection</strong><small>Connect to a remote PC or workspace.</small></div>
          </div>
          <div className={styles.rdpForm}>
            <label>
              Computer:
              <input value={server} onChange={(event) => setServer(event.target.value)} spellCheck={false} />
            </label>
            <label>
              User name:
              <input value={user} onChange={(event) => setUser(event.target.value)} spellCheck={false} />
            </label>
            <p><Network size={15} /> Gateway discovered on campus guest network</p>
          </div>
          <div className={styles.rdpFooter}>
            <button type="button" className={styles.showOptions}>Show Options</button>
            <button type="button" className={styles.winButton} onClick={connect}>Connect</button>
            <button type="button" className={styles.winButtonSecondary}>Help</button>
          </div>
        </section>
      )}

      {stage === "connecting" && (
        <section className={styles.connecting}>
          <div className={styles.connectLogo}><Monitor size={44} /></div>
          <h1>Connecting to JGI-ARCHIVE-02</h1>
          <p>{[
            "Initiating remote connection…",
            "Negotiating network credentials…",
            "Applying display configuration…",
            "Loading remote session…",
          ][connectionStep]}</p>
          <div className={styles.connectBar}><i style={{ width: `${(connectionStep + 1) * 25}%` }} /></div>
          <button type="button" onClick={resetConnection}>Cancel</button>
        </section>
      )}

      {stage !== "rdp" && stage !== "connecting" && (
        <>
          <div className={styles.remoteStrip}>
            <span>JGI-ARCHIVE-02.internal</span>
            <div><Minus size={13} /><Square size={11} /><X size={13} /></div>
          </div>

          <section className={styles.explorer} aria-label="File Explorer">
            <div className={styles.titlebar}>
              <span><Folder size={17} fill="#f3c94f" color="#dcae2f" /> Project Archive</span>
              <WindowButtons />
            </div>
            <div className={styles.explorerTabs}>
              <button type="button">New <span>+</span></button>
              <button type="button">Cut</button>
              <button type="button">Copy</button>
              <button type="button">Paste</button>
              <button type="button">Sort</button>
              <button type="button">View</button>
            </div>
            <div className={styles.addressRow}>
              <div className={styles.navButtons}>
                <button type="button" onClick={() => setCurrentFolder(null)} disabled={!currentFolder} aria-label="Back to archive root"><ChevronLeft /></button>
                <button type="button" disabled aria-label="Forward"><ChevronRight /></button>
                <button type="button" onClick={() => setCurrentFolder(null)} disabled={!currentFolder} aria-label="Up one level"><ChevronUp /></button>
                <button type="button" aria-label="Refresh"><RotateCw /></button>
              </div>
              <div className={styles.address}>
                <HardDrive size={15} /> This PC <b>›</b> JGI Secure Archive <b>›</b> Operation CANOPY
                {currentFolderMeta && <><b>›</b> {currentFolderMeta.name}</>}
              </div>
              <div className={styles.search}><Search size={15} /> Search {currentFolderMeta?.name ?? "Operation CANOPY"}</div>
            </div>
            <div className={styles.explorerBody}>
              <aside className={styles.sidebar}>
                <button type="button"><Folder /> Home</button>
                <button type="button"><Folder /> Gallery</button>
                <span>Quick access</span>
                <button type="button"><Monitor /> Desktop</button>
                <button type="button"><Folder /> Downloads</button>
                <button type="button"><Folder /> Documents</button>
                <span>Operation CANOPY</span>
                <button type="button" className={!currentFolder ? styles.sideActive : ""} onClick={() => setCurrentFolder(null)}><Folder /> Archive root</button>
                {FOLDERS.map((folder) => (
                  <button key={folder.id} type="button" className={currentFolder === folder.id ? styles.sideActive : ""} onClick={() => setCurrentFolder(folder.id)}>
                    <Folder /> {folder.name.replace(/^\d+_/, "").replaceAll("_", " ")}
                  </button>
                ))}
                <span>This PC</span>
                <button type="button"><HardDrive /> Local Disk (C:)</button>
                <button type="button"><Server /> JGI Secure Archive</button>
                <button type="button"><Network /> Network</button>
              </aside>
              <div className={styles.fileArea}>
                <div className={styles.folderHeading}>
                  <div>
                    <h2>{currentFolderMeta?.name ?? "Operation CANOPY"}</h2>
                    <p>{currentFolderMeta ? `${currentFolderMeta.owner} · restricted working records` : "Six restricted departments · synthetic/redacted records"}</p>
                  </div>
                  <div className={styles.discovery}><span>{primaryOpenedCount}/6 primary records examined</span><i><b style={{ width: `${progress}%` }} /></i></div>
                </div>
                <div className={styles.fileHeader}><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>
                <div className={styles.fileList}>
                  {!currentFolder && FOLDERS.map((folder) => {
                    const count = DOCS.filter((doc) => doc.folder === folder.id).length;
                    return (
                      <button key={folder.id} type="button" className={`${styles.fileRow} ${styles.folderRow}`} onDoubleClick={() => setCurrentFolder(folder.id)} onClick={() => setCurrentFolder(folder.id)}>
                        <span className={styles.fileName}><Folder size={27} fill="#f3c94f" color="#dcae2f" /><span>{folder.name}<small>{folder.owner}</small></span></span>
                        <span>{folder.modified}</span><span>File folder</span><span>{count} items</span>
                      </button>
                    );
                  })}
                  {currentFolder && visibleDocs.map((doc) => (
                    <button key={doc.id} type="button" className={`${styles.fileRow} ${opened.has(doc.id) ? styles.fileOpened : ""}`} onDoubleClick={() => openArchiveDoc(doc.id)} onClick={() => openArchiveDoc(doc.id)}>
                      <span className={styles.fileName}><FileGlyph doc={doc} /><span>{doc.name}<small>{opened.has(doc.id) ? "Opened" : doc.classification}</small></span></span>
                      <span>{doc.modified}</span><span>{doc.type}</span><span>{doc.size}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.explorerStatus}>
                  {currentFolder ? visibleDocs.length : FOLDERS.length} items
                  <span>{opened.size > 0 ? `${opened.size} document${opened.size === 1 ? "" : "s"} examined` : ""}</span>
                </div>
              </div>
            </div>
          </section>

          {selected && (
            <section className={styles.documentWindow} aria-label={selected.name}>
              <div className={styles.titlebar}>
                <span><FileGlyph doc={selected} size={17} /> {selected.name}</span>
                <div className={styles.windowButtons}>
                  <span><Minus size={14} /></span><span><Square size={11} /></span>
                  <button type="button" onClick={() => setOpenDoc(null)} aria-label="Close document"><X size={14} /></button>
                </div>
              </div>
              <div className={styles.docToolbar}><span>File</span><span>Home</span><span>Insert</span><span>Layout</span><span>Review</span><span>View</span></div>
              <div className={styles.documentBody}>{renderDocument(selected)}</div>
              <div className={styles.fragmentStamp}>{selected.fragment ? `archive checksum ${selected.fragment}/6` : selected.reference}</div>
            </section>
          )}

          {(stage === "locked" || stage === "recovery") && (
            <div className={styles.securityOverlay}>
              {stage === "locked" ? (
                <section className={styles.securityDialog}>
                  <div className={styles.securityTop}><ShieldAlert size={28} fill="#d83a3a" color="#fff" /><span>Windows Security</span><button type="button" aria-label="Close"><X size={17} /></button></div>
                  <div className={styles.securityContent}>
                    <ShieldAlert className={styles.bigShield} size={58} color="#d83a3a" />
                    <div>
                      <h2>Illegal remote access detected</h2>
                      <p>This session has accessed restricted files on <b>JGI-ARCHIVE-02</b>.</p>
                      <dl>
                        <div><dt>Incident</dt><dd>JGI-SOC-7714</dd></div>
                        <div><dt>Session</dt><dd>{user}</dd></div>
                        <div><dt>Status</dt><dd>Isolated · pending termination</dd></div>
                      </dl>
                      <p className={styles.securityNote}>Remote input has been suspended. Disconnect now, or complete archive recovery to regain access.</p>
                    </div>
                  </div>
                  <div className={styles.securityActions}>
                    <button type="button" onClick={resetConnection}>Disconnect</button>
                    <button type="button" className={styles.dangerButton} onClick={() => setStage("recovery")}><KeyRound size={16} /> Regain access</button>
                  </div>
                </section>
              ) : (
                <section className={`${styles.recoveryWindow} ${recoveryShake ? styles.recoveryShake : ""}`}>
                  <div className={styles.recoveryTitle}><span><LockKeyhole size={17} /> Archive Recovery Console</span><span>JGI-SOC</span></div>
                  <div className={styles.terminal}>
                    <p>device trust ............. <b className={styles.fail}>failed</b></p>
                    <p>session token ............ <b className={styles.fail}>revoked</b></p>
                    <p>archive checksum ......... <b className={styles.ok}>{primaryOpenedCount}/6 fragments cached</b></p>
                    <br />
                    <p className={styles.challenge}>check 3 — the name.</p>
                    <p className={styles.challenge}>it was in every document. six letters.</p>
                    <p className={styles.challenge}>spell it and regain access.</p>
                    <div className={`${styles.recoveryEntry} ${solved ? styles.recoverySolved : ""}`}>
                      {TARGET.split("").map((_, index) => <span key={index}>{solved ? TARGET[index] : recoveryEntry[index] ?? "_"}</span>)}
                    </div>
                    {!solved ? (
                      <div className={styles.recoveryTiles}>
                        {tiles.map((tile) => (
                          <button key={tile.id} type="button" disabled={usedTiles.has(tile.id)} onClick={() => pressRecoveryTile(tile.id, tile.letter)}>{tile.letter}</button>
                        ))}
                      </div>
                    ) : <p className={styles.accessRestored}>ACCESS RESTORED · decrypting programme identity…</p>}
                  </div>
                </section>
              )}
            </div>
          )}

          {stage === "reveal" && (
            <div className={styles.revealOverlay}>
              <section className={styles.revealWindow}>
                <div className={styles.revealMedia}><Image src="/udyaan-greenhouse.jpg" alt="Udyaan greenhouse site" fill priority sizes="(max-width: 800px) 100vw, 760px" /></div>
                <div className={styles.revealContent}>
                  <p>OPERATION CANOPY · IDENTITY DECLASSIFIED</p>
                  <div className={styles.revealBrand}><span><Leaf size={27} /></span><h1>Udyaan</h1></div>
                  <h2>The ₹14.38 crore file was never just a farm.</h2>
                  <p>It is a 100+ acre working campus for drone and robot farming, vertical microgreens, hydro-aeroponics and a live Bio-CNG loop.</p>
                  <p>The student roster was real: academic credit, field immersion, patent ownership and a venture path for what gets built.</p>
                  <div className={styles.metrics}>
                    <span><b>₹14.38 Cr</b>phase-II deployment</span>
                    <span><b>100+ acres</b>live field systems</span>
                    <span><b>cohort-01</b>intake now open</span>
                  </div>
                  <p className={styles.revealHint}>Your recovered session has been converted into an intake pass.</p>
                  <Link href="/survey" className={styles.surveyButton}>Open the Udyaan intake <ArrowRight size={18} /></Link>
                </div>
              </section>
            </div>
          )}

          <Taskbar clock={clock} />
        </>
      )}

      {stage === "rdp" && <Taskbar clock={clock} />}
      <span className={styles.fictionTag}>interactive fiction · records shown are synthetic and redacted</span>
    </main>
  );
}

function renderDocument(doc: ArchiveDoc) {
  switch (doc.id) {
    case "capex":
      return (
        <div className={styles.sheetDoc}>
          <header><h3>OPERATION CANOPY · PHASE II CAPITAL PLAN</h3><p>Finance Controller Draft · Board circulation prohibited</p></header>
          <div className={styles.sheetGrid + " " + styles.sheetGridHead}><span>Cost centre</span><span>Description</span><span>FY26 allocation</span></div>
          <div className={styles.sheetGrid}><span>CN-LAND-02</span><span>112-acre land consolidation + soil restoration</span><span>₹4,20,00,000</span></div>
          <div className={styles.sheetGrid}><span>CN-AUTO-04</span><span>18 survey drones + 4 autonomous field rovers</span><span>₹2,64,00,000</span></div>
          <div className={styles.sheetGrid}><span>CN-CEA-07</span><span>Vertical grow stacks + hydro-aeroponic controls</span><span>₹3,18,00,000</span></div>
          <div className={styles.sheetGrid}><span>CN-CIRC-03</span><span>Bio-CNG digester and campus micro-grid</span><span>₹2,75,00,000</span></div>
          <div className={styles.sheetGrid}><span>CN-STU-01</span><span>Student field housing, labs and prototype fund</span><span>₹1,61,00,000</span></div>
          <div className={`${styles.sheetGrid} ${styles.sheetTotal}`}><span /><span>PHASE II TOTAL</span><span>₹14,38,00,000</span></div>
          <p className={styles.docComment}>Comment by R. Menon: “Keep CANOPY off the public deck until the intake signal is validated.”</p>
        </div>
      );
    case "bank":
      return (
        <div className={styles.pdfDoc}>
          <p className={styles.classified}>RESTRICTED · FINANCE COPY · SYNTHETIC/REDACTED</p>
          <h3>Operation CANOPY · Vendor Disbursement Register</h3>
          <table><thead><tr><th>Beneficiary</th><th>Bank / account</th><th>Purpose</th><th>Released</th></tr></thead>
            <tbody>
              <tr><td>Verdant Robotics Pvt Ltd</td><td>HDFC · XXXX 4417</td><td>Field rover fleet</td><td>₹1.08 Cr</td></tr>
              <tr><td>AeroCrop Systems</td><td>ICICI · XXXX 9022</td><td>Drone mapping stack</td><td>₹86.4 L</td></tr>
              <tr><td>Closed Loop Energy</td><td>SBI · XXXX 7734</td><td>Bio-CNG commissioning</td><td>₹1.44 Cr</td></tr>
              <tr><td>GreenRise CEA</td><td>AXIS · XXXX 1180</td><td>Vertical farm phase</td><td>₹92.8 L</td></tr>
            </tbody>
          </table>
          <p>Instruction: invoices must refer only to “Operation CANOPY”. Public programme identity remains embargoed.</p>
        </div>
      );
    case "exam":
      return (
        <div className={styles.wordDoc}>
          <p className={styles.watermark}>SPECIMEN · NOT A LIVE EXAM PAPER</p>
          <h3>Semester VI · Applied Systems Assessment</h3>
          <p><b>Q4.</b> A CANOPY drip line uses 2 L/hr while overhead irrigation uses 9 L/hr for the same 40 plants. Calculate five-hour savings and identify a sensor that could validate flow. <b>[10]</b></p>
          <p><b>Q5.</b> An autonomous rover flags three high-stress zones in a 112-acre field. Design a queue that prioritises intervention by yield risk. <b>[12]</b></p>
          <p><b>Q6.</b> The CANOPY Bio-CNG digester loses 45% output when feedstock drops 30%. Explain the non-linear effect and propose telemetry. <b>[10]</b></p>
          <blockquote>Moderator note: “Why are CANOPY field cases appearing across CS, design, management and biotech papers?”</blockquote>
        </div>
      );
    case "students":
      return (
        <div className={styles.sheetDoc}>
          <header><h3>CANOPY COHORT-ZERO · FIELD ACCESS EXPORT</h3><p>Names and identifiers redacted · synthetic records</p></header>
          <div className={styles.rosterGrid + " " + styles.sheetGridHead}><span>Student</span><span>Discipline</span><span>Field hours</span><span>Prototype</span></div>
          <div className={styles.rosterGrid}><span>A████ S████</span><span>Computer Science</span><span>142</span><span>Drone stress mapper</span></div>
          <div className={styles.rosterGrid}><span>M████ R██</span><span>Biotechnology</span><span>118</span><span>Bio-CNG feed model</span></div>
          <div className={styles.rosterGrid}><span>S████ D█████</span><span>Mechanical</span><span>96</span><span>Low-cost field rover</span></div>
          <div className={styles.rosterGrid}><span>P████ K█████</span><span>Design</span><span>104</span><span>Farmer telemetry UX</span></div>
          <p className={styles.docComment}>Academic status: credit-bearing field immersion · Patent ownership: retained by student inventor.</p>
        </div>
      );
    case "wifi":
      return (
        <div className={styles.textDoc}>
          <p># CANOPY field network handover</p>
          <p># credentials below are fictional / non-functional</p>
          <br />
          <p>CANOPY-GREENHOUSE-01&nbsp;&nbsp;:&nbsp;&nbsp;[rotates weekly]</p>
          <p>CANOPY-DRONE-BAY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;[certificate only]</p>
          <p>CANOPY-BIOCNG-SCADA&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;[hardware key]</p>
          <p>CANOPY-COHORT-ZERO&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;[student badge auth]</p>
          <p>CANOPY-VENTURE-LAB&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;[not commissioned]</p>
          <br />
          <p># Site: 112 acres · Gateway uplink: JGI private fibre</p>
          <p># Do not expose programme name in SSID until launch approval.</p>
        </div>
      );
    case "board":
      return (
        <div className={styles.pdfDoc}>
          <p className={styles.classified}>BOARD EYES ONLY · OPERATION CANOPY</p>
          <h3>Phase II Positioning Note</h3>
          <p>CANOPY is not to be described as a “college farm”. The ₹14.38 crore commitment funds a living academic and venture system:</p>
          <ul>
            <li>students embedded in operational farmland for formal credit;</li>
            <li>cross-disciplinary teams building against measurable field constraints;</li>
            <li>student-owned patents and publications routed through an IP pipeline;</li>
            <li>a venture studio moving viable prototypes into market pilots.</li>
          </ul>
          <p>Public recruitment is intentionally withheld. Cohort-one should be sourced through a limited discovery experience that selects for curiosity, judgement and persistence.</p>
          <p className={styles.signature}>Approved in principle · JGI Strategic Projects Committee</p>
        </div>
      );
  }
}
