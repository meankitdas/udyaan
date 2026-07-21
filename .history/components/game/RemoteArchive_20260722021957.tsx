"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  ArrowRight,
  BatteryMedium,
  Bell,
  Bluetooth,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clipboard,
  Copy,
  FileKey,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Folder,
  Grid2X2,
  HardDrive,
  KeyRound,
  Leaf,
  List,
  LockKeyhole,
  LogOut,
  Minus,
  Monitor,
  Network,
  PanelBottom,
  Plane,
  Power,
  RotateCw,
  Scissors,
  Search,
  Server,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Sun,
  User,
  Users,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import styles from "./RemoteArchive.module.css";

type Stage = "rdp" | "connecting" | "desktop" | "locked" | "recovery" | "reveal";
type LockReason = "credential" | "intrusion";
type DesktopPanel = "start" | "search" | "taskview" | "quick" | "settings" | "remote" | null;
type LocalLocation = "home" | "desktop" | "documents" | "downloads" | "pictures" | "thispc" | "network";
type LocalItem = {
  id: string;
  name: string;
  kind: "folder" | "file" | "drive" | "network" | "shortcut";
  target?: LocalLocation | "remote";
  type: string;
  modified: string;
  size: string;
  preview?: "welcome" | "policy" | "guide" | "calendar";
};
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
  { id: "finance", name: "FY_2025-26_Financials_All_Campuses", owner: "Group Finance & Treasury", modified: "18/07/2026 22:41" },
  { id: "cohort", name: "Student_Master_Data_&_Academic_Records", owner: "Registrar & Student Records", modified: "09/07/2026 07:52" },
  { id: "academics", name: "Examinations_&_Semester_Papers", owner: "Examination & Academic Planning", modified: "12/07/2026 09:13" },
  { id: "infrastructure", name: "Campus_IT_WiFi_&_Infrastructure", owner: "Central IT & Estate Operations", modified: "04/07/2026 14:30" },
  { id: "governance", name: "Board_Minutes_&_Strategic_Projects", owner: "Board Secretariat", modified: "16/07/2026 08:22" },
  { id: "legal", name: "Legal_Procurement_&_Vendor_Contracts", owner: "Legal & Central Procurement", modified: "01/07/2026 23:19" },
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

const LOCAL_LOCATION_LABELS: Record<LocalLocation, string> = {
  home: "Home",
  desktop: "Desktop",
  documents: "Documents",
  downloads: "Downloads",
  pictures: "Pictures",
  thispc: "This PC",
  network: "Network",
};

const LOCAL_ITEMS: Record<LocalLocation, LocalItem[]> = {
  home: [
    { id: "desktop", name: "Desktop", kind: "folder", target: "desktop", type: "File folder", modified: "22/07/2026 01:12", size: "" },
    { id: "documents", name: "Documents", kind: "folder", target: "documents", type: "File folder", modified: "21/07/2026 18:04", size: "" },
    { id: "downloads", name: "Downloads", kind: "folder", target: "downloads", type: "File folder", modified: "20/07/2026 10:39", size: "" },
    { id: "pictures", name: "Pictures", kind: "folder", target: "pictures", type: "File folder", modified: "18/07/2026 14:21", size: "" },
    { id: "thispc", name: "This PC", kind: "drive", target: "thispc", type: "System folder", modified: "", size: "" },
    { id: "archive", name: "JGI Secure Archive", kind: "network", target: "remote", type: "Remote network location", modified: "Gateway discovered", size: "" },
  ],
  desktop: [
    { id: "rdp", name: "Remote Desktop Connection", kind: "shortcut", target: "remote", type: "Shortcut", modified: "22/07/2026 00:44", size: "1 KB" },
    { id: "shared", name: "Shared Archive", kind: "network", target: "remote", type: "Remote network location", modified: "Disconnected", size: "" },
    { id: "welcome", name: "Welcome.txt", kind: "file", type: "Text Document", modified: "19/07/2026 09:12", size: "2 KB", preview: "welcome" },
  ],
  documents: [
    { id: "policy", name: "Campus_Network_Usage_Policy.pdf", kind: "file", type: "PDF Document", modified: "14/07/2026 12:30", size: "418 KB", preview: "policy" },
    { id: "guide", name: "Remote_Access_Guide.txt", kind: "file", type: "Text Document", modified: "11/07/2026 16:22", size: "5 KB", preview: "guide" },
    { id: "calendar", name: "Academic_Calendar_2026.pdf", kind: "file", type: "PDF Document", modified: "02/07/2026 10:15", size: "1.1 MB", preview: "calendar" },
  ],
  downloads: [],
  pictures: [
    { id: "wallpaper", name: "campus_aerial_wallpaper.jpg", kind: "file", type: "JPEG image", modified: "18/07/2026 14:21", size: "842 KB" },
  ],
  thispc: [
    { id: "cdrive", name: "Local Disk (C:)", kind: "drive", type: "Local Disk", modified: "", size: "182 GB free of 256 GB" },
    { id: "archive-drive", name: "JGI Secure Archive", kind: "network", target: "remote", type: "Disconnected network drive", modified: "", size: "" },
  ],
  network: [
    { id: "jgi-archive", name: "JGI-ARCHIVE-02", kind: "network", target: "remote", type: "Remote computer", modified: "Discovered on campus guest gateway", size: "" },
  ],
};

function shuffle<T>(source: T[]): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function searchText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function WindowsMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`${styles.windowsMark} ${small ? styles.windowsMarkSmall : ""}`} aria-hidden>
      <i /><i /><i /><i />
    </span>
  );
}

function FileGlyph({ doc, size = 26 }: { doc: ArchiveDoc; size?: number }) {
  const Icon = doc.type.includes("Excel") || doc.type.includes("Values")
    ? FileSpreadsheet
    : doc.type.includes("Word") || doc.type.includes("Text")
      ? FileText
      : FileKey;
  return <Icon size={size} strokeWidth={1.7} style={{ color: doc.color }} />;
}

function LocalGlyph({ item, size = 26 }: { item: LocalItem; size?: number }) {
  if (item.kind === "folder") return <Folder size={size} fill="#f3c94f" color="#dcae2f" />;
  if (item.kind === "drive") return <HardDrive size={size} color="#5a7d9d" />;
  if (item.kind === "network") return <Server size={size} color="#4d81b5" />;
  if (item.kind === "shortcut") return <Monitor size={size} color="#3a7eca" />;
  return <FileText size={size} color={item.type.includes("PDF") ? "#d65050" : "#64727e"} />;
}

function WindowButtons({ onMinimize, onMaximize, onClose }: { onMinimize?: () => void; onMaximize?: () => void; onClose?: () => void }) {
  return (
    <div className={styles.windowButtons}>
      <button type="button" onClick={onMinimize} aria-label="Minimize"><Minus size={14} /></button>
      <button type="button" onClick={onMaximize} aria-label="Maximize"><Square size={11} /></button>
      <button type="button" onClick={onClose} aria-label="Close"><X size={14} /></button>
    </div>
  );
}

function Taskbar({
  clock,
  active,
  onStart,
  onSearch,
  onTaskView,
  onExplorer,
  onRemote,
  onQuick,
}: {
  clock: Date;
  active: "explorer" | "remote" | null;
  onStart: () => void;
  onSearch: () => void;
  onTaskView: () => void;
  onExplorer: () => void;
  onRemote: () => void;
  onQuick: () => void;
}) {
  return (
    <div className={styles.taskbar}>
      <div className={styles.taskIcons}>
        <button type="button" title="Start" aria-label="Start" onClick={onStart}><WindowsMark small /></button>
        <button type="button" title="Search" aria-label="Search" onClick={onSearch}><Search size={20} /></button>
        <button type="button" title="Task view" aria-label="Task view" onClick={onTaskView}><PanelBottom size={20} /></button>
        <button type="button" className={active === "explorer" ? styles.taskActive : ""} title="File Explorer" aria-label="File Explorer" onClick={onExplorer}><Folder size={21} fill="#f3c94f" color="#dcae2f" /></button>
        <button type="button" className={active === "remote" ? styles.taskActive : ""} title="Remote Desktop" aria-label="Remote Desktop" onClick={onRemote}><Monitor size={20} color="#4e88d9" /></button>
      </div>
      <button type="button" className={styles.tray} onClick={onQuick} aria-label="Quick settings">
        <ChevronUp size={14} />
        <Wifi size={16} />
        <Volume2 size={16} />
        <BatteryMedium size={17} />
        <span>
          <b>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
          <small>{clock.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })}</small>
        </span>
      </button>
    </div>
  );
}

function LocalPreview({ item }: { item: LocalItem }) {
  if (item.preview === "welcome") {
    return <div className={styles.localDoc}><h2>Welcome to this PC</h2><p>This local Windows profile can be used normally. The <b>JGI Secure Archive</b> is a separate remote resource and requires Remote Desktop Connection.</p><p>Tip: use Start, Search, Task View, Quick Settings and File Explorer before connecting.</p></div>;
  }
  if (item.preview === "policy") {
    return <div className={styles.localDoc}><p className={styles.classified}>LOCAL REFERENCE COPY</p><h2>Campus Network Usage Policy</h2><p><b>1. Scope.</b> Campus guest access provides internet connectivity but does not grant access to internal systems.</p><p><b>2. Remote resources.</b> Approved internal hosts require authenticated Remote Desktop or VPN access. Repeated failed credentials may be reported to security monitoring.</p><p><b>3. Privacy.</b> This interactive experience uses only fictional, synthetic and redacted data.</p></div>;
  }
  if (item.preview === "guide") {
    return <div className={styles.localDoc}><h2>Remote Access Guide</h2><ol><li>Open Remote Desktop Connection.</li><li>Confirm the computer name shown by the campus gateway.</li><li>Use only credentials assigned to your session.</li><li>Disconnect when finished; never copy restricted records to the local PC.</li></ol><p>Gateway status: discovered · Authentication status: not connected.</p></div>;
  }
  return <div className={styles.localDoc}><h2>Academic Calendar 2026</h2><table><tbody><tr><th>Semester opens</th><td>03 August 2026</td></tr><tr><th>Continuous assessment I</th><td>14–19 September</td></tr><tr><th>Project review</th><td>12–17 October</td></tr><tr><th>Semester examinations</th><td>23 November–08 December</td></tr></tbody></table></div>;
}

export function RemoteArchive() {
  const [stage, setStage] = useState<Stage>("rdp");
  const [connectionStep, setConnectionStep] = useState(0);
  const [lockReason, setLockReason] = useState<LockReason>("intrusion");
  const [activePanel, setActivePanel] = useState<DesktopPanel>(null);
  const [rdpVisible, setRdpVisible] = useState(true);
  const [rdpMaximized, setRdpMaximized] = useState(false);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [explorerMaximized, setExplorerMaximized] = useState(false);
  const [localLocation, setLocalLocation] = useState<LocalLocation>("home");
  const [localPreview, setLocalPreview] = useState<LocalItem | null>(null);
  const [localPreviewMaximized, setLocalPreviewMaximized] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<FolderId | null>(null);
  const [openDoc, setOpenDoc] = useState<DocId | null>(null);
  const [opened, setOpened] = useState<Set<DocId>>(new Set());
  const [triggered, setTriggered] = useState(false);
  const [credentialPrompt, setCredentialPrompt] = useState(false);
  const [financialUnlocked, setFinancialUnlocked] = useState(false);
  const [financePassword, setFinancePassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [sortAscending, setSortAscending] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [toast, setToast] = useState("");
  const [wifiOn, setWifiOn] = useState(true);
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [airplaneOn, setAirplaneOn] = useState(false);
  const [volume, setVolume] = useState(64);
  const [brightness, setBrightness] = useState(76);
  const [recoveryEntry, setRecoveryEntry] = useState("");
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [recoveryShake, setRecoveryShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [server, setServer] = useState("JGI-ARCHIVE-02.internal");
  const [user, setUser] = useState("campus\\temporary-user");
  const toastTimerRef = useRef<number | null>(null);
  const tiles = useMemo(() => shuffle([..."UDYAANRX"].map((letter, id) => ({ letter, id }))), []);
  const remoteConnected = stage !== "rdp" && stage !== "connecting";
  const currentFolderMeta = currentFolder ? FOLDERS.find((folder) => folder.id === currentFolder) ?? null : null;
  const visibleFolders = useMemo(
    () => FOLDERS.filter((folder) => searchText(folder.name).includes(searchText(searchQuery))).sort((a, b) => sortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)),
    [searchQuery, sortAscending],
  );
  const visibleDocs = useMemo(
    () => (currentFolder ? DOCS.filter((doc) => doc.folder === currentFolder) : [])
      .filter((doc) => searchText(`${doc.name} ${doc.type} ${doc.owner} ${doc.reference}`).includes(searchText(searchQuery)))
      .sort((a, b) => sortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)),
    [currentFolder, searchQuery, sortAscending],
  );
  const visibleLocalItems = useMemo(
    () => LOCAL_ITEMS[localLocation]
      .filter((item) => searchText(`${item.name} ${item.type}`).includes(searchText(searchQuery)))
      .sort((a, b) => sortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)),
    [localLocation, searchQuery, sortAscending],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
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
    if (stage !== "desktop" || triggered) return;
    const delay = 18000 + Math.random() * 14000;
    const timer = window.setTimeout(() => {
      setTriggered(true);
      setLockReason("intrusion");
      setStage("locked");
      setActivePanel(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [stage, triggered]);

  const connect = () => {
    if (!server.trim()) return;
    setRdpVisible(true);
    setLocalPreview(null);
    setStage("connecting");
  };

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const navigateToFolder = useCallback((folder: FolderId | null) => {
    setSearchQuery("");
    setSelectedName("");
    if (folder === "finance" && !financialUnlocked) {
      setCredentialPrompt(true);
      setFinancePassword("");
      return;
    }
    setCurrentFolder(folder);
    setExplorerVisible(true);
    setOpenDoc(null);
  }, [financialUnlocked]);

  const navigateLocal = useCallback((location: LocalLocation) => {
    setLocalLocation(location);
    setSearchQuery("");
    setSelectedName("");
    setLocalPreview(null);
    setExplorerVisible(true);
    setActivePanel(null);
  }, []);

  const openLocalItem = useCallback((item: LocalItem) => {
    setSelectedName(item.name);
    if (item.target === "remote") {
      setRdpVisible(true);
      setActivePanel(null);
      showToast("Remote connection required for JGI-ARCHIVE-02");
      return;
    }
    if (item.target) {
      navigateLocal(item.target);
      return;
    }
    if (item.preview) {
      setLocalPreview(item);
      return;
    }
    showToast(`${item.name} is available locally`);
  }, [navigateLocal, showToast]);

  const openSecureFolder = useCallback((folder: FolderId) => {
    if (!remoteConnected) {
      setRdpVisible(true);
      setLocalPreview(null);
      setActivePanel(null);
      showToast("Connect Remote Desktop before opening JGI Secure Archive");
      return;
    }
    navigateToFolder(folder);
  }, [navigateToFolder, remoteConnected, showToast]);

  const submitFinancePassword = useCallback(() => {
    if (financePassword.trim().toUpperCase() === "CANOPY26") {
      setFinancialUnlocked(true);
      setCredentialPrompt(false);
      setFinancePassword("");
      setCurrentFolder("finance");
      showToast("Access granted to FY 2025–26 Financials");
      return;
    }
    setCredentialPrompt(false);
    setFinancePassword("");
    setLockReason("credential");
    setTriggered(true);
    setStage("locked");
    setActivePanel(null);
  }, [financePassword, showToast]);

  const togglePanel = useCallback((panel: Exclude<DesktopPanel, null>) => {
    setActivePanel((current) => current === panel ? null : panel);
  }, []);

  const restoreExplorer = useCallback(() => {
    setExplorerVisible((visible) => !visible);
    setActivePanel(null);
  }, []);

  const openRemoteControl = useCallback(() => {
    if (stage === "rdp") {
      setRdpVisible(true);
      setLocalPreview(null);
      setActivePanel(null);
    } else {
      togglePanel("remote");
    }
  }, [stage, togglePanel]);

  const handleReadOnlyAction = useCallback((action: string) => {
    showToast(`${action} blocked: JGI Secure Archive is mounted read-only`);
  }, [showToast]);

  const copySelection = useCallback(async () => {
    if (!selectedName) {
      showToast("Select a folder or file first");
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedName);
      showToast(`Copied “${selectedName}”`);
    } catch {
      showToast(`Selected “${selectedName}”`);
    }
  }, [selectedName, showToast]);

  const openArchiveDoc = (id: DocId) => {
    const doc = DOCS.find((item) => item.id === id);
    if (doc) setSelectedName(doc.name);
    setOpenDoc(id);
    setOpened((current) => new Set(current).add(id));
  };

  const resetConnection = () => {
    setStage("rdp");
    setRdpVisible(true);
    setRdpMaximized(false);
    setExplorerVisible(true);
    setExplorerMaximized(false);
    setActivePanel(null);
    setLocalLocation("home");
    setLocalPreview(null);
    setLocalPreviewMaximized(false);
    setCurrentFolder(null);
    setOpenDoc(null);
    setOpened(new Set());
    setTriggered(false);
    setCredentialPrompt(false);
    setFinancialUnlocked(false);
    setFinancePassword("");
    setSearchQuery("");
    setGlobalSearchQuery("");
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
  const progress = Math.min(100, Math.round((opened.size / DOCS.length) * 100));

  return (
    <main className={styles.shell}>
      <div className={styles.wallpaper} aria-hidden />
      <button type="button" className={styles.desktopIcon} onDoubleClick={restoreExplorer} onClick={restoreExplorer}>
        <span><Folder size={31} fill="#f3c94f" color="#dcae2f" /></span>
        <small>This PC</small>
      </button>
      <button type="button" className={`${styles.desktopIcon} ${styles.desktopIconSecond}`} onDoubleClick={openRemoteControl} onClick={openRemoteControl}>
        <span><Monitor size={30} color="#63a0ef" /></span>
        <small>Remote Desktop</small>
      </button>

      {stage === "rdp" && explorerVisible && (
        <section className={`${styles.explorer} ${explorerMaximized ? styles.explorerMaximized : ""}`} aria-label="File Explorer">
          <div className={styles.titlebar}>
            <span><Folder size={17} fill="#f3c94f" color="#dcae2f" /> File Explorer</span>
            <WindowButtons onMinimize={() => setExplorerVisible(false)} onMaximize={() => setExplorerMaximized((value) => !value)} onClose={() => { setExplorerVisible(false); setLocalPreview(null); }} />
          </div>
          <div className={styles.explorerTabs}>
            <button type="button" onClick={() => showToast("New folder created in memory for this demo")}><FilePlus2 size={14} /> New</button>
            <button type="button" onClick={() => showToast("Select a local item before cutting")}><Scissors size={14} /> Cut</button>
            <button type="button" onClick={copySelection}><Copy size={14} /> Copy</button>
            <button type="button" onClick={() => showToast("Clipboard is empty")}><Clipboard size={14} /> Paste</button>
            <button type="button" onClick={() => setSortAscending((value) => !value)}><SlidersHorizontal size={14} /> Sort {sortAscending ? "A–Z" : "Z–A"}</button>
            <button type="button" onClick={() => setCompactView((value) => !value)}>{compactView ? <List size={14} /> : <Grid2X2 size={14} />} {compactView ? "Details" : "Compact"}</button>
          </div>
          <div className={styles.addressRow}>
            <div className={styles.navButtons}>
              <button type="button" onClick={() => navigateLocal("home")} disabled={localLocation === "home"} aria-label="Back to Home"><ChevronLeft /></button>
              <button type="button" disabled aria-label="Forward"><ChevronRight /></button>
              <button type="button" onClick={() => navigateLocal("home")} disabled={localLocation === "home"} aria-label="Up to Home"><ChevronUp /></button>
              <button type="button" onClick={() => showToast(`${LOCAL_LOCATION_LABELS[localLocation]} refreshed`)} aria-label="Refresh"><RotateCw /></button>
            </div>
            <div className={styles.address}><Folder size={15} /> Home {localLocation !== "home" && <><b>›</b> {LOCAL_LOCATION_LABELS[localLocation]}</>}</div>
            <label className={styles.search}><Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${LOCAL_LOCATION_LABELS[localLocation]}`} /></label>
          </div>
          <div className={styles.explorerBody}>
            <aside className={styles.sidebar}>
              <button type="button" className={localLocation === "home" ? styles.sideActive : ""} onClick={() => navigateLocal("home")}><Folder /> Home</button>
              <span>Quick access</span>
              <button type="button" className={localLocation === "desktop" ? styles.sideActive : ""} onClick={() => navigateLocal("desktop")}><Monitor /> Desktop</button>
              <button type="button" className={localLocation === "downloads" ? styles.sideActive : ""} onClick={() => navigateLocal("downloads")}><Folder /> Downloads</button>
              <button type="button" className={localLocation === "documents" ? styles.sideActive : ""} onClick={() => navigateLocal("documents")}><Folder /> Documents</button>
              <button type="button" className={localLocation === "pictures" ? styles.sideActive : ""} onClick={() => navigateLocal("pictures")}><Folder /> Pictures</button>
              <span>This PC</span>
              <button type="button" className={localLocation === "thispc" ? styles.sideActive : ""} onClick={() => navigateLocal("thispc")}><HardDrive /> This PC</button>
              <button type="button" className={localLocation === "network" ? styles.sideActive : ""} onClick={() => navigateLocal("network")}><Network /> Network</button>
            </aside>
            <div className={styles.fileArea}>
              <div className={styles.folderHeading}>
                <div><h2>{LOCAL_LOCATION_LABELS[localLocation]}</h2><p>Local Windows profile · remote archive not connected</p></div>
                <div className={styles.discovery}><span>{visibleLocalItems.length} items</span><i><b style={{ width: "100%" }} /></i></div>
              </div>
              <div className={styles.fileHeader}><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>
              <div className={`${styles.fileList} ${compactView ? styles.compactList : ""}`}>
                {visibleLocalItems.map((item) => (
                  <button key={item.id} type="button" className={styles.fileRow} onClick={() => openLocalItem(item)} onDoubleClick={() => openLocalItem(item)}>
                    <span className={styles.fileName}><LocalGlyph item={item} /><span>{item.name}<small>{item.kind === "network" ? "Connection required" : ""}</small></span></span>
                    <span>{item.modified}</span><span>{item.type}</span><span>{item.size}</span>
                  </button>
                ))}
                {visibleLocalItems.length === 0 && <div className={styles.emptyFolder}>This folder is empty.</div>}
              </div>
              <div className={styles.explorerStatus}>{visibleLocalItems.length} items <span>{localLocation === "network" ? "Network discovery enabled" : "Local profile"}</span></div>
            </div>
          </div>
        </section>
      )}

      {stage === "rdp" && localPreview && (
        <section className={`${styles.documentWindow} ${localPreviewMaximized ? styles.documentMaximized : ""}`} aria-label={localPreview.name}>
          <div className={styles.titlebar}>
            <span><LocalGlyph item={localPreview} size={17} /> {localPreview.name}</span>
            <WindowButtons onMinimize={() => setLocalPreview(null)} onMaximize={() => setLocalPreviewMaximized((value) => !value)} onClose={() => { setLocalPreview(null); setLocalPreviewMaximized(false); }} />
          </div>
          <div className={styles.docToolbar}><span>File</span><span>Home</span><span>Share</span><span>View</span></div>
          <div className={styles.documentBody}><LocalPreview item={localPreview} /></div>
          <div className={styles.fragmentStamp}>LOCAL · READ ONLY</div>
        </section>
      )}

      {stage === "rdp" && rdpVisible && (
        <section className={`${styles.rdpWindow} ${rdpMaximized ? styles.rdpMaximized : ""}`} aria-label="Remote Desktop Connection">
          <div className={styles.titlebar}>
            <span><Monitor size={16} color="#2768ba" /> Remote Desktop Connection</span>
            <WindowButtons onMinimize={() => setRdpVisible(false)} onMaximize={() => setRdpMaximized((value) => !value)} onClose={() => setRdpVisible(false)} />
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

          {explorerVisible && <section className={`${styles.explorer} ${explorerMaximized ? styles.explorerMaximized : ""}`} aria-label="File Explorer">
            <div className={styles.titlebar}>
              <span><Folder size={17} fill="#f3c94f" color="#dcae2f" /> Project Archive</span>
              <WindowButtons onMinimize={() => setExplorerVisible(false)} onMaximize={() => setExplorerMaximized((value) => !value)} onClose={() => { setExplorerVisible(false); setOpenDoc(null); }} />
            </div>
            <div className={styles.explorerTabs}>
              <button type="button" onClick={() => handleReadOnlyAction("New item")}><FilePlus2 size={14} /> New</button>
              <button type="button" onClick={() => handleReadOnlyAction("Cut")}><Scissors size={14} /> Cut</button>
              <button type="button" onClick={copySelection}><Copy size={14} /> Copy</button>
              <button type="button" onClick={() => handleReadOnlyAction("Paste")}><Clipboard size={14} /> Paste</button>
              <button type="button" onClick={() => setSortAscending((value) => !value)}><SlidersHorizontal size={14} /> Sort {sortAscending ? "A–Z" : "Z–A"}</button>
              <button type="button" onClick={() => setCompactView((value) => !value)}>{compactView ? <List size={14} /> : <Grid2X2 size={14} />} {compactView ? "Details" : "Compact"}</button>
            </div>
            <div className={styles.addressRow}>
              <div className={styles.navButtons}>
                <button type="button" onClick={() => navigateToFolder(null)} disabled={!currentFolder} aria-label="Back to archive root"><ChevronLeft /></button>
                <button type="button" disabled aria-label="Forward"><ChevronRight /></button>
                <button type="button" onClick={() => navigateToFolder(null)} disabled={!currentFolder} aria-label="Up one level"><ChevronUp /></button>
                <button type="button" onClick={() => showToast("Archive listing refreshed")} aria-label="Refresh"><RotateCw /></button>
              </div>
              <div className={styles.address}>
                <HardDrive size={15} /> This PC <b>›</b> JGI Secure Archive <b>›</b> Operation CANOPY
                {currentFolderMeta && <><b>›</b> {currentFolderMeta.name}</>}
              </div>
              <label className={styles.search}><Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${currentFolderMeta?.name ?? "Operation CANOPY"}`} /></label>
            </div>
            <div className={styles.explorerBody}>
              <aside className={styles.sidebar}>
                <button type="button" onClick={() => showToast("Home is unavailable inside this restricted session")}><Folder /> Home</button>
                <button type="button" onClick={() => showToast("Gallery contains no indexed items")}><Folder /> Gallery</button>
                <span>Quick access</span>
                <button type="button" onClick={() => { setExplorerVisible(false); setOpenDoc(null); }}><Monitor /> Desktop</button>
                <button type="button" onClick={() => showToast("Downloads is empty on JGI-ARCHIVE-02")}><Folder /> Downloads</button>
                <button type="button" onClick={() => showToast("Documents is redirected to the secure archive")}><Folder /> Documents</button>
                <span>Operation CANOPY</span>
                <button type="button" className={!currentFolder ? styles.sideActive : ""} onClick={() => navigateToFolder(null)}><Folder /> Archive root</button>
                {FOLDERS.map((folder) => (
                  <button key={folder.id} type="button" className={currentFolder === folder.id ? styles.sideActive : ""} onClick={() => navigateToFolder(folder.id)}>
                    <Folder /> {folder.name.replace(/^\d+_/, "").replaceAll("_", " ")}
                  </button>
                ))}
                <span>This PC</span>
                <button type="button" onClick={() => showToast("Local disk access denied by Remote Desktop policy")}><HardDrive /> Local Disk (C:)</button>
                <button type="button" onClick={() => navigateToFolder(null)}><Server /> JGI Secure Archive</button>
                <button type="button" onClick={() => showToast("Network discovery is disabled on this profile")}><Network /> Network</button>
              </aside>
              <div className={styles.fileArea}>
                <div className={styles.folderHeading}>
                  <div>
                    <h2>{currentFolderMeta?.name ?? "Operation CANOPY"}</h2>
                    <p>{currentFolderMeta ? `${currentFolderMeta.owner} · restricted working records` : "Six restricted departments · synthetic/redacted records"}</p>
                  </div>
                  <div className={styles.discovery}><span>{opened.size}/{DOCS.length} documents opened</span><i><b style={{ width: `${progress}%` }} /></i></div>
                </div>
                <div className={styles.fileHeader}><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>
                <div className={`${styles.fileList} ${compactView ? styles.compactList : ""}`}>
                  {!currentFolder && visibleFolders.map((folder) => {
                    const count = DOCS.filter((doc) => doc.folder === folder.id).length;
                    return (
                      <button key={folder.id} type="button" className={`${styles.fileRow} ${styles.folderRow}`} onDoubleClick={() => navigateToFolder(folder.id)} onClick={() => { setSelectedName(folder.name); navigateToFolder(folder.id); }}>
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
          </section>}

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
                      <p>{lockReason === "credential"
                        ? <>An invalid credential was submitted to <b>FY 2025–26 Financials — All Campuses</b>.</>
                        : <>JGI-SOC detected an untrusted session reading restricted records on <b>JGI-ARCHIVE-02</b>.</>}
                      </p>
                      <dl>
                        <div><dt>Incident</dt><dd>{lockReason === "credential" ? "JGI-SOC-4019" : "JGI-SOC-7714"}</dd></div>
                        <div><dt>Session</dt><dd>{user}</dd></div>
                        <div><dt>Signal</dt><dd>{lockReason === "credential" ? "Protected-share authentication failure" : "Abnormal archive traversal pattern"}</dd></div>
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
                    <p>archive cache ............ <b className={styles.ok}>{opened.size} documents retained</b></p>
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

        </>
      )}

      {credentialPrompt && stage === "desktop" && (
        <div className={styles.credentialOverlay}>
          <section className={styles.credentialDialog}>
            <div className={styles.credentialTop}><ShieldAlert size={21} color="#2671bd" /><span>Windows Security</span><button type="button" onClick={() => setCredentialPrompt(false)} aria-label="Close"><X size={16} /></button></div>
            <div className={styles.credentialBody}>
              <Monitor size={42} color="#2475c5" />
              <div>
                <h2>Enter network credentials</h2>
                <p>Enter your credentials to connect to:</p>
                <strong>JGI-ARCHIVE-02\FY_2025-26_Financials_All_Campuses</strong>
                <label><User size={16} /><input value={user} readOnly aria-label="User name" /></label>
                <label><KeyRound size={16} /><input type="password" value={financePassword} onChange={(event) => setFinancePassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitFinancePassword(); }} placeholder="Password" autoFocus aria-label="Password" /></label>
                <p className={styles.passwordHint}>Password hint: internal project codename + FY ending · fictional credential</p>
              </div>
            </div>
            <div className={styles.credentialActions}><button type="button" onClick={() => setCredentialPrompt(false)}>Cancel</button><button type="button" className={styles.winButton} onClick={submitFinancePassword}>OK</button></div>
          </section>
        </div>
      )}

      {activePanel === "start" && (
        <section className={styles.startMenu}>
          <label><Search size={16} /><input placeholder="Search for apps, settings, and documents" onFocus={() => setActivePanel("search")} /></label>
          <div className={styles.menuHeader}><span>Pinned</span><button type="button">All apps <ChevronRight size={13} /></button></div>
          <div className={styles.pinnedApps}>
            <button type="button" onClick={restoreExplorer}><Folder fill="#f3c94f" color="#dcae2f" /><span>File Explorer</span></button>
            <button type="button" onClick={openRemoteControl}><Monitor color="#3a7eca" /><span>Remote Desktop</span></button>
            <button type="button" onClick={() => setActivePanel("settings")}><Settings color="#667480" /><span>Settings</span></button>
            <button type="button" onClick={() => showToast("Windows Security: session monitoring is active")}><ShieldAlert color="#337abb" /><span>Security</span></button>
            <button type="button" onClick={() => openSecureFolder("cohort")}><Users color="#5a70c7" /><span>Student Data</span></button>
            <button type="button" onClick={() => openSecureFolder("finance")}><FileSpreadsheet color="#24865a" /><span>Financials</span></button>
          </div>
          <div className={styles.startFooter}><span><User size={18} /> campus\temporary-user</span><button type="button" onClick={resetConnection} aria-label="Disconnect"><Power size={18} /></button></div>
        </section>
      )}

      {activePanel === "search" && (
        <section className={styles.searchPanel}>
          <label><Search size={17} /><input autoFocus value={globalSearchQuery} onChange={(event) => setGlobalSearchQuery(event.target.value)} placeholder={remoteConnected ? "Search Operation CANOPY" : "Search this PC"} /></label>
          <p>Best match</p>
          <div className={styles.searchResults}>
            {!remoteConnected && Object.values(LOCAL_ITEMS).flat().filter((item) => searchText(`${item.name} ${item.type}`).includes(searchText(globalSearchQuery))).slice(0, 8).map((item) => (
              <button key={`local-${item.id}`} type="button" onClick={() => { openLocalItem(item); setActivePanel(null); }}><LocalGlyph item={item} size={23} /><span>{item.name}<small>{item.type} · This PC</small></span></button>
            ))}
            {remoteConnected && FOLDERS.filter((folder) => searchText(folder.name).includes(searchText(globalSearchQuery))).slice(0, 4).map((folder) => (
              <button key={folder.id} type="button" onClick={() => { navigateToFolder(folder.id); setActivePanel(null); }}><Folder fill="#f3c94f" color="#dcae2f" /><span>{folder.name.replaceAll("_", " ")}<small>File folder · {DOCS.filter((doc) => doc.folder === folder.id).length} items</small></span></button>
            ))}
            {remoteConnected && DOCS.filter((doc) => searchText(`${doc.name} ${doc.summary}`).includes(searchText(globalSearchQuery))).slice(0, 6).map((doc) => (
              <button key={doc.id} type="button" onClick={() => { if (doc.folder === "finance" && !financialUnlocked) navigateToFolder("finance"); else { setCurrentFolder(doc.folder); setOpenDoc(doc.id); setExplorerVisible(true); setOpened((current) => new Set(current).add(doc.id)); } setActivePanel(null); }}><FileGlyph doc={doc} size={23} /><span>{doc.name}<small>{doc.folder} · {doc.classification}</small></span></button>
            ))}
          </div>
        </section>
      )}

      {activePanel === "taskview" && (
        <section className={styles.taskView}>
          <h2>Desktops</h2>
          <div className={styles.taskCards}>
            <button type="button" onClick={() => { setExplorerVisible(true); setActivePanel(null); }}><span className={styles.taskPreview}><Folder size={35} fill="#f3c94f" color="#dcae2f" /></span><b>{remoteConnected ? "Project Archive" : "File Explorer"}</b><small>{remoteConnected ? "JGI-ARCHIVE-02" : `This PC · ${LOCAL_LOCATION_LABELS[localLocation]}`}</small></button>
            <button type="button" onClick={openRemoteControl}><span className={styles.taskPreview}><Monitor size={35} color="#3b7fca" /></span><b>Remote Desktop</b><small>{remoteConnected ? "Connected · campus\\temporary-user" : "Not connected · JGI-ARCHIVE-02 available"}</small></button>
          </div>
        </section>
      )}

      {activePanel === "quick" && (
        <section className={styles.quickPanel}>
          <div className={styles.quickGrid}>
            <button type="button" className={wifiOn ? styles.quickOn : ""} onClick={() => setWifiOn((value) => !value)}><Wifi /><span>Wi-Fi</span></button>
            <button type="button" className={bluetoothOn ? styles.quickOn : ""} onClick={() => setBluetoothOn((value) => !value)}><Bluetooth /><span>Bluetooth</span></button>
            <button type="button" className={airplaneOn ? styles.quickOn : ""} onClick={() => setAirplaneOn((value) => !value)}><Plane /><span>Airplane mode</span></button>
            <button type="button" onClick={() => showToast("Battery saver unavailable while plugged in")}><BatteryMedium /><span>Battery saver</span></button>
          </div>
          <label><Sun size={17} /><input type="range" min="10" max="100" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label>
          <label><Volume2 size={17} /><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          <footer><BatteryMedium size={17} /> 78% available <button type="button" onClick={() => setActivePanel("settings")}><Settings size={16} /></button></footer>
        </section>
      )}

      {(activePanel === "settings" || activePanel === "remote") && (
        <section className={styles.systemPanel}>
          <header><span>{activePanel === "settings" ? <Settings size={18} /> : <Monitor size={18} />}{activePanel === "settings" ? "Settings" : "Remote Desktop Connection"}</span><button type="button" onClick={() => setActivePanel(null)}><X size={16} /></button></header>
          {activePanel === "settings" ? <><h2>System</h2><p><b>Display</b><small>1280 × 800 · {remoteConnected ? "Remote display adapter" : "Built-in display"}</small></p><p><b>Network & internet</b><small>{wifiOn ? "Connected through campus guest gateway" : "Wi-Fi disabled"}</small></p><p><b>Privacy & security</b><small>{remoteConnected ? "Remote session monitoring active" : "Local Windows security active"}</small></p></> : <><h2>Remote session</h2><p><b>Computer</b><small>{server}</small></p><p><b>User</b><small>{user}</small></p><p><b>Status</b><small>{remoteConnected ? "Connected · UDP enabled" : "Not connected"}</small></p>{remoteConnected ? <button type="button" className={styles.disconnectButton} onClick={resetConnection}><LogOut size={16} /> Disconnect</button> : <button type="button" className={styles.disconnectButton} onClick={() => { setRdpVisible(true); setActivePanel(null); }}><Monitor size={16} /> Open connection</button>}</>}
        </section>
      )}

      {toast && <div className={styles.toast}><Bell size={16} />{toast}</div>}

      {stage !== "connecting" && <Taskbar
        clock={clock}
        active={stage === "rdp" && rdpVisible ? "remote" : explorerVisible ? "explorer" : null}
        onStart={() => togglePanel("start")}
        onSearch={() => { setGlobalSearchQuery(""); togglePanel("search"); }}
        onTaskView={() => togglePanel("taskview")}
        onExplorer={restoreExplorer}
        onRemote={openRemoteControl}
        onQuick={() => togglePanel("quick")}
      />}
      <span className={styles.fictionTag}>interactive fiction · records shown are synthetic and redacted</span>
    </main>
  );
}

function renderDocument(doc: ArchiveDoc) {
  switch (doc.id) {
    case "capex":
      return (
        <div className={styles.sheetDoc}>
          <DocMeta doc={doc} />
          <header><h3>OPERATION CANOPY · PHASE II CAPITAL PLAN</h3><p>Consolidated model · Values in INR · Scenario: approved baseline</p></header>
          <div className={styles.formulaBar}><span>F27</span><span>fx</span><code>=SUM(F14:F26)+Contingency_Draw</code></div>
          <p className={styles.docSection}>1. Funding envelope</p>
          <table className={styles.supportingTable}>
            <thead><tr><th>Funding source</th><th>Sanction ref.</th><th>Committed</th><th>Drawn</th><th>Restriction</th></tr></thead>
            <tbody>
              <tr><td>JGI strategic projects reserve</td><td>SPC/26/071</td><td>₹6,20,00,000</td><td>₹3,84,00,000</td><td>Land + core systems only</td></tr>
              <tr><td>Term facility · fictional bank</td><td>TF-CN-8841</td><td>₹4,50,00,000</td><td>₹1,75,00,000</td><td>Milestone certified</td></tr>
              <tr><td>Innovation & sustainability pool</td><td>ISP/2026/14</td><td>₹1,28,00,000</td><td>₹42,00,000</td><td>Student/IP packages</td></tr>
              <tr><td>Board contingency reserve</td><td>BR-09/26</td><td>₹2,40,00,000</td><td>₹0</td><td>CFO + SPC chair approval</td></tr>
              <tr className={styles.sheetTotal}><td colSpan={2}>TOTAL APPROVED ENVELOPE</td><td>₹14,38,00,000</td><td>₹6,01,00,000</td><td>41.79% drawn</td></tr>
            </tbody>
          </table>
          <p className={styles.docSection}>2. Package control ledger</p>
          <table className={styles.supportingTable}>
            <thead><tr><th>WBS / package</th><th>Approved</th><th>Committed</th><th>Forecast</th><th>Variance</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>CN-LAND-02 · 112-acre consolidation</td><td>₹4.20 Cr</td><td>₹4.08 Cr</td><td>₹4.16 Cr</td><td>+₹4 L</td><td><i className={styles.statusPill}>on plan</i></td></tr>
              <tr><td>CN-AUTO-04 · drones + field rovers</td><td>₹2.64 Cr</td><td>₹2.41 Cr</td><td>₹2.71 Cr</td><td>−₹7 L</td><td><i className={`${styles.statusPill} ${styles.statusAmber}`}>watch</i></td></tr>
              <tr><td>CN-CEA-07 · vertical + hydro systems</td><td>₹3.18 Cr</td><td>₹2.86 Cr</td><td>₹3.11 Cr</td><td>+₹7 L</td><td><i className={styles.statusPill}>on plan</i></td></tr>
              <tr><td>CN-CIRC-03 · Bio-CNG + micro-grid</td><td>₹2.75 Cr</td><td>₹2.62 Cr</td><td>₹2.87 Cr</td><td>−₹12 L</td><td><i className={`${styles.statusPill} ${styles.statusRed}`}>escalated</i></td></tr>
              <tr><td>CN-STU-01 · housing, labs, prototype fund</td><td>₹1.61 Cr</td><td>₹1.02 Cr</td><td>₹1.53 Cr</td><td>+₹8 L</td><td><i className={styles.statusPill}>on plan</i></td></tr>
            </tbody>
          </table>
          <p className={styles.docComment}>Cell F27 · R. Menon: “Keep CANOPY off the public deck. External descriptions must say ‘distributed learning infrastructure’ until the intake signal is validated.”</p>
          <p className={styles.docFinePrint}>Model assumptions: GST recoverability per tax memo CN-TAX-06; escalation at 4.8%; FX reference ₹84.30/USD; no land appreciation included; prototype fund recognised only on mentor approval.</p>
          <div className={styles.approvalGrid}><span>Prepared by<b>Programme Finance · 16 Jul</b></span><span>Reviewed by<b>Group Treasury · 17 Jul</b></span><span>Approval status<b>Conditional · SPC minute 11</b></span></div>
          <WorkbookTabs labels={["Executive Summary", "Package Ledger", "Monthly Cashflow", "Funding Sources", "Commitments", "Assumptions", "Change Log"]} />
        </div>
      );
    case "bank":
      return (
        <div className={styles.pdfDoc}>
          <DocMeta doc={doc} />
          <p className={styles.classified}>RESTRICTED · FINANCE COPY · SYNTHETIC/REDACTED</p>
          <h3>Operation CANOPY · Vendor Disbursement & Banking Control Register</h3>
          <p><b>Reporting period:</b> 01 April–30 June 2026 · <b>Entity:</b> fictional JGI Strategic Projects SPV · <b>Currency:</b> INR</p>
          <table><thead><tr><th>Beneficiary</th><th>Bank / masked account</th><th>PO / milestone</th><th>Gross</th><th>Retention</th><th>Released</th></tr></thead>
            <tbody>
              <tr><td>Verdant Robotics Pvt Ltd</td><td>HDFC · XXXX 4417 · IFSC redacted</td><td>CN-PO-044 / FAT accepted</td><td>₹1.08 Cr</td><td>₹10.8 L</td><td>₹97.2 L</td></tr>
              <tr><td>AeroCrop Systems</td><td>ICICI · XXXX 9022 · IFSC redacted</td><td>CN-PO-051 / 12 drones delivered</td><td>₹86.4 L</td><td>₹4.32 L</td><td>₹82.08 L</td></tr>
              <tr><td>Closed Loop Energy</td><td>SBI · XXXX 7734 · IFSC redacted</td><td>CN-PO-037 / digester hydro-test</td><td>₹1.44 Cr</td><td>₹14.4 L</td><td>₹1.296 Cr</td></tr>
              <tr><td>GreenRise CEA</td><td>AXIS · XXXX 1180 · IFSC redacted</td><td>CN-PO-062 / 60% stack install</td><td>₹92.8 L</td><td>₹9.28 L</td><td>₹83.52 L</td></tr>
              <tr><td>FieldSense Instruments</td><td>KOTAK · XXXX 3661 · IFSC redacted</td><td>CN-PO-073 / calibration lot 1</td><td>₹38.6 L</td><td>₹1.93 L</td><td>₹36.67 L</td></tr>
            </tbody>
          </table>
          <p className={styles.docSection}>Control exceptions and release notes</p>
          <table><thead><tr><th>Exception</th><th>Impact</th><th>Compensating control</th><th>Owner / due</th></tr></thead>
            <tbody>
              <tr><td>PO-037 bank confirmation received after payment cut-off</td><td>Low</td><td>Independent callback + beneficiary master freeze</td><td>Treasury · Closed</td></tr>
              <tr><td>PO-051 invoice references public drone model</td><td>Medium</td><td>Archive under CANOPY codename; communications review</td><td>Procurement · 22 Jul</td></tr>
              <tr><td>PO-062 retention wording differs from contract schedule</td><td>Medium</td><td>Legal side-letter before second release</td><td>Legal · 25 Jul</td></tr>
            </tbody>
          </table>
          <p>Standing instruction: remittance narratives must refer only to “Operation CANOPY”. Public identity remains under board embargo. Account fields above are synthetic and non-functional.</p>
          <div className={styles.approvalGrid}><span>Maker<b>Treasury Analyst · ID T-014</b></span><span>Checker<b>Finance Controller · ID F-002</b></span><span>Bank release<b>Dual authorisation complete</b></span></div>
          <p className={styles.docFinePrint}>Appendices: A—beneficiary KYC checklist; B—sanctions screening extract; C—milestone certificates; D—retention reconciliation; E—synthetic bank confirmation log.</p>
        </div>
      );
    case "exam":
      return (
        <div className={styles.wordDoc}>
          <DocMeta doc={doc} />
          <p className={styles.watermark}>SPECIMEN · NOT A LIVE EXAM PAPER</p>
          <h3>Semester VI · Applied Systems Assessment · Common Field Case</h3>
          <p><b>Duration:</b> 120 minutes · <b>Maximum:</b> 60 marks · <b>Case pack:</b> CANOPY telemetry extract CN-DATA-17</p>
          <p className={styles.docSection}>Instructions to candidates</p>
          <ol><li>State assumptions and units. Unsupported numerical answers receive no process marks.</li><li>Use the supplied synthetic telemetry; do not infer personal or operational data.</li><li>Attempt any four questions, including one from Section C.</li></ol>
          <p className={styles.docSection}>Section A · Quantitative reasoning</p>
          <p><b>Q1.</b> A CANOPY drip line supplies 2 L/hr while overhead irrigation uses 9 L/hr for the same 40-plant bed. Derive five-hour water savings, annualise for 220 operating days and identify a meter class suitable for validation. <b>[10]</b></p>
          <p><b>Q2.</b> A six-layer vertical stack yields 0.82× open-field output per layer. Include 7% handling loss and calculate effective yield multiple versus equal footprint. <b>[8]</b></p>
          <p className={styles.docSection}>Section B · Systems design</p>
          <p><b>Q3.</b> A rover flags three high-stress zones across 112 acres. Define a priority queue using crop value, stress confidence, travel cost and intervention deadline. Provide pseudocode and tie-breaking logic. <b>[12]</b></p>
          <p><b>Q4.</b> The CANOPY Bio-CNG digester loses 45% gas output when feedstock falls 30%. Propose a sensor set, fault tree and minimum telemetry retention needed to separate temperature, loading and instrumentation effects. <b>[12]</b></p>
          <p className={styles.docSection}>Section C · Responsible deployment</p>
          <p><b>Q5.</b> A student prototype changes an irrigation schedule automatically. Draft a human override, audit trail and rollback design that works with intermittent connectivity. <b>[10]</b></p>
          <p><b>Q6.</b> Explain why a technically accurate farm model may still fail adoption. Answer from farmer workflow, unit economics and trust perspectives. <b>[8]</b></p>
          <blockquote><b>Moderation comment AC-47:</b> “CANOPY cases now appear in CS, biotechnology, design and management. Confirm common outcomes are mapped consistently and the project identity remains embargoed in student-facing copies.”</blockquote>
          <div className={styles.approvalGrid}><span>Question author<b>Applied Systems Cell</b></span><span>Moderator<b>External reviewer · redacted</b></span><span>Status<b>Specimen approved · not live</b></span></div>
        </div>
      );
    case "students":
      return (
        <div className={styles.sheetDoc}>
          <DocMeta doc={doc} />
          <header><h3>CANOPY COHORT-ZERO · FIELD ACCESS & IP EXPORT</h3><p>Snapshot 2026-W27 · Names and identifiers redacted · synthetic records</p></header>
          <div className={styles.formulaBar}><span>K19</span><span>fx</span><code>=IF(AND(Field_Hours&gt;=90,Evidence_Status="Verified"),"Credit Eligible","Review")</code></div>
          <div className={styles.rosterGrid + " " + styles.sheetGridHead}><span>Student</span><span>Discipline</span><span>Field hours</span><span>Prototype</span></div>
          <div className={styles.rosterGrid}><span>A████ S████</span><span>Computer Science</span><span>142</span><span>Drone stress mapper</span></div>
          <div className={styles.rosterGrid}><span>M████ R██</span><span>Biotechnology</span><span>118</span><span>Bio-CNG feed model</span></div>
          <div className={styles.rosterGrid}><span>S████ D█████</span><span>Mechanical</span><span>96</span><span>Low-cost field rover</span></div>
          <div className={styles.rosterGrid}><span>P████ K█████</span><span>Design</span><span>104</span><span>Farmer telemetry UX</span></div>
          <div className={styles.rosterGrid}><span>R████ N███</span><span>Commerce</span><span>91</span><span>Apartment market pilot</span></div>
          <div className={styles.rosterGrid}><span>K████ V████</span><span>Electronics</span><span>127</span><span>Low-power soil node</span></div>
          <p className={styles.docSection}>Evidence and ownership controls</p>
          <table className={styles.supportingTable}><thead><tr><th>Prototype ID</th><th>Evidence</th><th>Mentor review</th><th>IP position</th><th>Credit status</th></tr></thead>
            <tbody>
              <tr><td>CN-P-001</td><td>Git + field validation set</td><td>Accepted 08 Jul</td><td>Student-owned · licence option</td><td><i className={styles.statusPill}>eligible</i></td></tr>
              <tr><td>CN-P-004</td><td>Digester model + calibration</td><td>Revision requested</td><td>Joint authorship review</td><td><i className={`${styles.statusPill} ${styles.statusAmber}`}>review</i></td></tr>
              <tr><td>CN-P-007</td><td>Rover CAD + costed BOM</td><td>Accepted 10 Jul</td><td>Student-owned</td><td><i className={styles.statusPill}>eligible</i></td></tr>
              <tr><td>CN-P-009</td><td>Research log incomplete</td><td>Pending</td><td>Not assessed</td><td><i className={`${styles.statusPill} ${styles.statusRed}`}>hold</i></td></tr>
            </tbody>
          </table>
          <p className={styles.docComment}>Academic status: field immersion is credit-bearing under AC/47/2026. Patent ownership remains with student inventors unless a separately signed collaboration schedule applies.</p>
          <p className={styles.docFinePrint}>Privacy controls: direct identifiers tokenised at source; mentor access role-bound; location telemetry retained 30 days; assessment evidence retained through appeal period; export generated from synthetic demonstration data.</p>
          <WorkbookTabs labels={["Roster", "Field Hours", "Evidence", "IP Position", "Mentors", "Credit Rules", "Audit Log"]} />
        </div>
      );
    case "wifi":
      return (
        <div className={styles.textDoc}>
          <DocMeta doc={doc} />
          <p># CANOPY FIELD NETWORK HANDOVER · build 26.07-rc3</p>
          <p># fictional configuration · credentials and addresses are non-functional</p>
          <br />
          <p>[site]</p>
          <p>code=CN-112A&nbsp;&nbsp;&nbsp;area_acres=112&nbsp;&nbsp;&nbsp;uplink=JGI_PRIVATE_FIBRE</p>
          <p>core_pair=CN-CORE-01/CN-CORE-02&nbsp;&nbsp;&nbsp;ha_mode=active-standby</p>
          <br />
          <p>[ssid_inventory]</p>
          <p>CANOPY-GREENHOUSE-01&nbsp;&nbsp;vlan=210&nbsp;&nbsp;auth=EAP-TLS&nbsp;&nbsp;rotation=weekly</p>
          <p>CANOPY-DRONE-BAY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;vlan=230&nbsp;&nbsp;auth=device-cert&nbsp;&nbsp;internet=deny</p>
          <p>CANOPY-BIOCNG-SCADA&nbsp;&nbsp;&nbsp;vlan=240&nbsp;&nbsp;auth=hardware-key&nbsp;&nbsp;east-west=deny</p>
          <p>CANOPY-COHORT-ZERO&nbsp;&nbsp;&nbsp;vlan=260&nbsp;&nbsp;auth=badge+device&nbsp;&nbsp;expiry=14h</p>
          <p>CANOPY-VENTURE-LAB&nbsp;&nbsp;&nbsp;&nbsp;vlan=280&nbsp;&nbsp;auth=not-commissioned</p>
          <br />
          <p>[network_controls]</p>
          <p>default_policy=deny&nbsp;&nbsp;&nbsp;dns_filter=enabled&nbsp;&nbsp;&nbsp;client_isolation=true</p>
          <p>scada_remote_access=jump-host+MFA&nbsp;&nbsp;&nbsp;session_recording=365d</p>
          <p>student_badge_sync=15m&nbsp;&nbsp;&nbsp;lost_device_revoke_sla=30m</p>
          <br />
          <p>[open_actions]</p>
          <p>NET-144&nbsp;&nbsp;move greenhouse cameras off management vlan&nbsp;&nbsp;owner=site-it&nbsp;&nbsp;due=22-jul</p>
          <p>NET-151&nbsp;&nbsp;complete drone bay RF survey&nbsp;&nbsp;owner=uas-cell&nbsp;&nbsp;due=25-jul</p>
          <p>NET-158&nbsp;&nbsp;remove CANOPY token from broadcast names before public launch&nbsp;&nbsp;owner=comms</p>
          <br />
          <p># Do not expose programme identity in any SSID until embargo release.</p>
        </div>
      );
    case "board":
      return (
        <div className={styles.pdfDoc}>
          <DocMeta doc={doc} />
          <p className={styles.classified}>BOARD EYES ONLY · OPERATION CANOPY</p>
          <h3>Phase II Positioning, Governance & Intake Note</h3>
          <p><b>Purpose.</b> This note seeks confirmation of the phase-II operating model, ₹14.38 crore envelope, academic governance and controlled cohort-one discovery process.</p>
          <p className={styles.docSection}>1. Strategic position</p>
          <p>CANOPY must not be described as a “college farm”. The investment creates a living academic and venture system with production-grade field infrastructure:</p>
          <ul>
            <li>students embedded in operational farmland under approved academic credit rules;</li>
            <li>cross-disciplinary teams building against measurable water, yield, energy and market constraints;</li>
            <li>student-owned patents and publications routed through a documented IP pipeline;</li>
            <li>a venture studio moving technically and commercially viable prototypes into controlled pilots.</li>
          </ul>
          <p className={styles.docSection}>2. Operating architecture</p>
          <table><thead><tr><th>Workstream</th><th>Accountable body</th><th>Decision right</th><th>Quarterly evidence</th></tr></thead>
            <tbody>
              <tr><td>Field systems</td><td>Site PMO</td><td>Safety + operations</td><td>Uptime, yield, intervention log</td></tr>
              <tr><td>Academic integration</td><td>Academic Council delegate</td><td>Credits + assessment</td><td>Outcome map, moderation, appeals</td></tr>
              <tr><td>IP and venture</td><td>Innovation Committee</td><td>Licence + pilot gate</td><td>Disclosure, ownership, validation</td></tr>
              <tr><td>Student welfare</td><td>Field Immersion Cell</td><td>Access + safeguarding</td><td>Hours, incidents, mentor reviews</td></tr>
            </tbody>
          </table>
          <p className={styles.docSection}>3. Intake control</p>
          <p>Public recruitment remains withheld. Cohort-one should be sourced through a limited discovery experience that selects for curiosity, judgement and persistence without using protected demographic factors. The public programme identity remains embargoed until recovery completion.</p>
          <p className={styles.docSection}>4. Resolutions requested</p>
          <ol><li>Note phase-I readiness and approve the phase-II ceiling of ₹14.38 crore.</li><li>Approve AC/47/2026 credit equivalence and student-inventor ownership exceptions.</li><li>Authorise a controlled discovery intake capped by field mentor capacity.</li><li>Require legal, safety, privacy and financial closure before public identity release.</li></ol>
          <div className={styles.approvalGrid}><span>SPC Chair<b>Approved in principle</b></span><span>CFO<b>Envelope confirmed</b></span><span>Academic delegate<b>Subject to AC/47 controls</b></span></div>
          <p className={styles.signature}>Recorded by Programme Secretariat · Minute reference SPC/26/071 · Annexures A–F incorporated by reference.</p>
        </div>
      );
    default:
      return <SupportingDocument doc={doc} />;
  }
}

function DocMeta({ doc }: { doc: ArchiveDoc }) {
  return (
    <div className={styles.docMeta}>
      <span>Classification<b>{doc.classification}</b></span>
      <span>Document reference<b>{doc.reference}</b></span>
      <span>Record owner<b>{doc.owner}</b></span>
      <span>Last modified<b>{doc.modified}</b></span>
    </div>
  );
}

function WorkbookTabs({ labels }: { labels: string[] }) {
  return <div className={styles.workbookTabs}>{labels.map((label) => <span key={label}>{label}</span>)}</div>;
}

const SUPPORTING_ROWS: Record<FolderId, [string, string, string, string][]> = {
  finance: [
    ["CN-LAND-02", "Land consolidation and soil restoration", "₹4.16 Cr forecast", "Finance + Legal"],
    ["CN-AUTO-04", "Drone and rover packages", "₹2.71 Cr forecast", "UAS Cell"],
    ["CN-CEA-07", "Controlled-environment agriculture", "₹3.11 Cr forecast", "CEA Lead"],
    ["CN-CIRC-03", "Bio-CNG and micro-grid", "₹2.87 Cr forecast", "Circular Systems"],
    ["CN-STU-01", "Student labs and prototype fund", "₹1.53 Cr forecast", "Programme Office"],
  ],
  governance: [
    ["DEC-071-A", "Maintain CANOPY naming embargo", "Approved", "Group Communications"],
    ["DEC-071-B", "Release phase-II funding by milestone", "Approved with conditions", "CFO"],
    ["ACT-11-04", "Close mentor capacity gap before intake", "Due 29 Jul", "Academic Planning"],
    ["RSK-016", "Discovery flow may exceed mentor capacity", "High / mitigated", "Programme Director"],
    ["ACT-11-09", "Complete safety case for student access", "In progress", "Site PMO"],
  ],
  academics: [
    ["PO-1", "Apply disciplinary knowledge to live field constraints", "Mapped across 8 programmes", "Academic Planning"],
    ["PO-2", "Produce auditable technical and commercial evidence", "Rubric approved", "Assessment Board"],
    ["PO-3", "Work safely in cross-disciplinary field teams", "Mentor-observed", "Field Immersion Cell"],
    ["AC/47", "Convert verified immersion into elective/project credit", "Approved", "Registrar"],
    ["MOD-06", "Common-case moderation across schools", "Quarterly", "Academic Council"],
  ],
  cohort: [
    ["CN-P-001", "Drone stress mapper", "Student-owned", "Validation complete"],
    ["CN-P-004", "Bio-CNG feed model", "Joint authorship review", "Calibration revision"],
    ["CN-P-007", "Low-cost field rover", "Student-owned", "Pilot gate passed"],
    ["CN-P-009", "Farmer telemetry UX", "Student-owned", "Research log pending"],
    ["CN-P-012", "Apartment market pilot", "Student-owned", "Unit economics review"],
  ],
  infrastructure: [
    ["SYS-CEA-01", "Vertical stack and nutrient controls", "82% commissioned", "GreenRise CEA"],
    ["SYS-UAS-02", "Mapping drones and geofence controls", "Flight pack approved", "UAS Cell"],
    ["SYS-IOT-03", "Soil, flow and climate sensor mesh", "Lot 1 calibrated", "Precision Ag Lab"],
    ["SYS-CIRC-04", "Bio-CNG SCADA and micro-grid", "SAT exceptions open", "Circular Systems"],
    ["SYS-NET-05", "Segmented field network", "Handover pending", "Site IT"],
  ],
  legal: [
    ["LEG-DD-019", "Land title and access rights", "Conditional closure", "General Counsel"],
    ["ENV-021", "Water, waste and biodiversity permits", "14/17 complete", "Compliance"],
    ["DPIA-03", "Student telemetry and assessment evidence", "Mitigations accepted", "DPO"],
    ["IP-014", "Student inventor ownership exceptions", "Template approved", "IP Counsel"],
    ["SAFE-008", "Field access and autonomous systems safety", "Final review", "Site PMO"],
  ],
};

function SupportingDocument({ doc }: { doc: ArchiveDoc }) {
  const rows = SUPPORTING_ROWS[doc.folder];
  const isWorkbook = doc.type.includes("Excel") || doc.type.includes("Values");
  return (
    <div className={styles.supportingDoc}>
      <DocMeta doc={doc} />
      <p className={doc.classification.includes("BOARD") || doc.classification.includes("LEGAL") ? styles.classified : styles.watermark}>{doc.classification}</p>
      <h3>{doc.name.replace(/\.(xlsx|docx|pdf|csv|txt)$/i, "").replaceAll("_", " ")}</h3>
      <p>{doc.summary}</p>
      {isWorkbook && <div className={styles.formulaBar}><span>D18</span><span>fx</span><code>=IF(Control_Status="Open",Forecast_Exposure,0)</code></div>}
      <p className={styles.docSection}>Record control and linked workstreams</p>
      <table className={styles.supportingTable}>
        <thead><tr><th>Reference</th><th>Scope / decision</th><th>Position</th><th>Accountable owner</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
      </table>
      <p className={styles.docSection}>Revision and assurance history</p>
      <table className={styles.supportingTable}>
        <thead><tr><th>Revision</th><th>Date</th><th>Change</th><th>Review result</th></tr></thead>
        <tbody>
          <tr><td>0.7</td><td>24 Jun 2026</td><td>Initial CANOPY package baseline imported</td><td>Returned with comments</td></tr>
          <tr><td>0.9</td><td>02 Jul 2026</td><td>Added phase-II control references and owner actions</td><td>Conditional acceptance</td></tr>
          <tr><td>1.0</td><td>{doc.modified.split(" ")[0]}</td><td>Reconciled to {doc.reference} and board envelope</td><td><i className={styles.statusPill}>current</i></td></tr>
        </tbody>
      </table>
      <p className={styles.docComment}>Reviewer note: “Cross-reference all external descriptions to Operation CANOPY. Do not disclose the public programme identity before the discovery intake closes.”</p>
      <div className={styles.approvalGrid}><span>Record owner<b>{doc.owner}</b></span><span>Independent review<b>Control Assurance · complete</b></span><span>Next review<b>Before cohort-one activation</b></span></div>
      <p className={styles.docFinePrint}>Related records: CN-FIN-26-041 · SPC/26/071 · AC/47/2026 · DPIA/CN/2026-03. This is a synthetic interactive-fiction record; names, references and financial details do not represent real accounts or transactions.</p>
      {isWorkbook && <WorkbookTabs labels={["Summary", "Detail", "Controls", "Evidence", "Dependencies", "Change Log"]} />}
    </div>
  );
}
