import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { backendHost } from '../utils/env';
import { devlog, deverror } from '../utils/devlog';
import styles from './Dashboard.module.css';
import formStyles from './Form.module.css';
import Toast from './Toast';
import InfoTooltip from './InfoTooltip';
import { responseCodes } from '../utils/responseCodes';
import jwtDecode from 'jwt-decode';
import moment from '../utils/time';
import { normalizeDeviceActivity, toDashboardStatusLabel } from '../utils/deviceStatus';

const statusTooltips = {
  'Not Yet Linked': 'Access your raspberry shake device to link it to your e-hub account.',
  'Not Streaming': 'This device is linked to your account but is currently not sending data to the server.',
  Streaming: 'This device is sending data to the server.',
  Unlinked: 'This device was unlinked from the sender.',
};

const roleCopy = {
  citizen: {
    overline: 'Citizen scientist workspace',
    title: 'Your devices',
    subtitle: 'Keep your personal instruments online and streaming to the UPRI Earthquake Network.',
    devicesIntro: 'Connectivity and health for your linked instruments.',
    empty: {
      title: 'No devices connected yet',
      body: 'Link your Raspberry Shake or sensor to start contributing live data.',
      steps: [
        'Connect your device to power and the internet.',
        'Open rs.local:3000 on the same network and sign in with this contributor account.',
        'Link the device to your account, then return here to verify it is streaming.',
      ],
    },
  },
  brgy: {
    overline: 'Barangay operator workspace',
    title: 'Managed devices',
    subtitle: 'Monitor barangay instruments, tokens, and future monitoring tools.',
    devicesIntro: 'Streaming status across barangay-managed stations.',
    empty: {
      title: 'No managed devices yet',
      body: 'Connect your barangay instruments and forward data with an active access token.',
      steps: [
        'Generate a barangay access token in the Tools & tokens tab and add it to your ringserver configuration.',
        'Ensure each station is powered and forwarding to the UPRI endpoint.',
        'Return here to see status once devices begin streaming.',
      ],
    },
  },
};

const getStatusVariant = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('unlinked')) return 'muted';
  // Check negative states first to avoid "not streaming" matching the streaming branch
  if (value.includes('not streaming') || value === 'inactive') return 'warn';
  if (value.includes('streaming') || value === 'active') return 'ok';
  return 'muted';
};

const formatStatusSince = (value) => {
  if (!value) return '—';
  const m = moment(value);
  if (!m.isValid()) return value;
  if (m.valueOf() <= 0) return '—';
  return `${m.fromNow()} · ${m.format('MMM D, YYYY')}`;
};

const ACCOUNT_PASSWORD_MAX_LENGTH = 128;
const discouragedPasswords = [
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty',
  'letmein',
  'welcome',
  'earthquake',
  'upri',
  'citizen',
  'brgy',
];

const USERNAME_RULE = {
  min: 3,
  max: 32,
  pattern: /^[a-zA-Z0-9._-]+$/,
};

const describeUsernameIssue = (value) => {
  const normalized = (value || '').trim();
  if (!normalized) return 'Username is required.';
  if (normalized.length < USERNAME_RULE.min) {
    return `Username must be at least ${USERNAME_RULE.min} characters.`;
  }
  if (normalized.length > USERNAME_RULE.max) {
    return `Username must be ${USERNAME_RULE.max} characters or fewer.`;
  }
  if (!USERNAME_RULE.pattern.test(normalized)) {
    return 'Usernames can include letters, numbers, dashes, underscores, and periods only.';
  }
  return '';
};

const describeAccountPasswordIssue = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > ACCOUNT_PASSWORD_MAX_LENGTH) return 'Password must be 128 characters or fewer.';
  const trimmed = password.trim();
  const lower = trimmed.toLowerCase();
  if (discouragedPasswords.includes(lower)) return 'Choose a less common password.';
  if (/^\d+$/.test(trimmed)) return 'Password cannot be numbers only.';
  if (/(.)\1{7,}/.test(trimmed)) return 'Avoid repeating the same character.';
  return '';
};

const EyeIcon = ({ revealed = false }) => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 12s3.5-6 10.5-6 10.5 6 10.5 6-3.5 6-10.5 6S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3.25" />
    {!revealed && <line x1="4" y1="4" x2="20" y2="20" />}
  </svg>
);

const SignOutIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 4h-6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6" />
    <path d="M10 12h10" />
    <path d="m16 8 4 4-4 4" />
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="M6 6 18 18" />
  </svg>
);
const BrokenChainIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 15 5.5 18.5a3 3 0 0 1-4-4L5 11" />
    <path d="M15 9 18.5 5.5a3 3 0 0 1 4 4L19 13" />
    <path d="m5.5 11.5 7 1" />
    <path d="m17.5 12.5-7-1" />
  </svg>
);
const TrashIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 6h14l-1 14H6L5 6Z" />
  </svg>
);

const PencilIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m13.5 6.5 3 3" />
  </svg>
);

const renderEmptyStateDetails = (emptyState) => {
  if (!emptyState) return '';
  const steps = emptyState.steps || [];
  return (
    <>
      {emptyState.body || ''}
      {steps.length ? (
        <>
          <br />
          <br />
          {steps.map((step, idx) => (
            <span key={`${idx}-${step}`}>
              {idx + 1}. {step}
              {idx < steps.length - 1 ? <br /> : null}
            </span>
          ))}
        </>
      ) : null}
    </>
  );
};

/**
 * User dashboard modal showing devices and barangay token management.
 */
function Dashboard({
  onClick,
  onEscapeClick,
  onSignoutSuccess,
  loggedInUser,
  loggedInUserRole,
  accountEmail,
  passwordStatus,
  passwordPolicyVersion,
  onProfileRefresh,
}) {
  const [pageTransition, setPageTransition] = useState(0); // controls dashboard transition from pageX to profile or vice-versa
  const [devices, setDevices] = useState([]); // hook for list of device in table (array)success message
  const [releasedDevices, setReleasedDevices] = useState([]);
  const [devicesFetched, setDevicesFetched] = useState(false);
  const [brgyAccessToken, setBrgyAccessToken] = useState(); // hook for brgyAccessToken
  const [accessTokenExpiry, setAccessTokenExpiry] = useState(); // hook for brgy accessToken expiration
  const [activeSection, setActiveSection] = useState('devices'); // workspace tabs
  const [openSettingsSection, setOpenSettingsSection] = useState(null); // account settings collapsibles
  const [emailForm, setEmailForm] = useState({
    email: accountEmail || '',
    currentPassword: '',
  });
  const [usernameForm, setUsernameForm] = useState({
    newUsername: '',
    currentPassword: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailErrors, setEmailErrors] = useState({});
  const [usernameErrors, setUsernameErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({
    emailCurrent: false,
    newPassword: false,
    confirmPassword: false,
    currentPassword: false,
    usernameCurrent: false,
  });
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const addDeviceFormRef = useRef(null);
  const dashboardContainerRef = useRef(null);
  const profileRef = useRef(null);
  const profileScrollRef = useRef(null);
  const usernameCardRef = useRef(null);
  const emailCardRef = useRef(null);
  const passwordCardRef = useRef(null);
  const deleteCardRef = useRef(null);
  const deleteConfirmRef = useRef(null);
  const deleteDialogId = useMemo(
    () => `delete-confirm-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const deleteTitleId = `${deleteDialogId}-title`;
  const deleteBodyId = `${deleteDialogId}-body`;
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true); // guard async state updates after unmount
  const timeoutsRef = useRef([]); // track pending timers for cleanup
  const eventSourceRef = useRef(null);

  // Utility: schedule clearing the toast with automatic cleanup
  const scheduleToastClear = useCallback((ms) => {
    const id = setTimeout(() => {
      if (!isMountedRef.current) return;
      setToastMessage('');
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

  const formatAccessTokenExpiry = useCallback((duration) => {
    if (!duration || typeof duration.asDays !== 'function' || typeof duration.asHours !== 'function') {
      return '—';
    }
    const days = Math.floor(duration.asDays());
    if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.max(1, Math.ceil(duration.asHours()));
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }, []);

  const toggleSettingsSection = (sectionId) => {
    const next = openSettingsSection === sectionId ? null : sectionId;
    setOpenSettingsSection(next);
    if (next === 'username') {
      setUsernameForm((prev) => ({
        ...prev,
        newUsername: loggedInUser || '',
        currentPassword: '',
      }));
    }
    if (next === 'email') {
      setEmailForm((prev) => ({
        ...prev,
        email: accountEmail || '',
        currentPassword: '',
      }));
    }
    setEmailErrors({});
    setUsernameErrors({});
    setPasswordErrors({});
    setShowDeleteConfirm(false);
  };

  const scrollToSettingsCard = useCallback((target) => {
    if (!target) return;
    const container = profileScrollRef.current;
    if (!container) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const padding = 24;
    const outOfView =
      targetRect.top < containerRect.top + padding ||
      targetRect.bottom > containerRect.bottom - padding;
    if (outOfView) {
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - padding;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    }
  }, []);

  const handleOpenPasswordSettings = useCallback(() => {
    setActiveSection('account');
    setOpenSettingsSection('password');
    setEmailErrors({});
    setUsernameErrors({});
    setPasswordErrors({});
    setShowDeleteConfirm(false);
    const id = setTimeout(() => {
      scrollToSettingsCard(passwordCardRef.current);
    }, 0);
    timeoutsRef.current.push(id);
  }, [
    scrollToSettingsCard,
    setActiveSection,
    setOpenSettingsSection,
    setEmailErrors,
    setUsernameErrors,
    setPasswordErrors,
    setShowDeleteConfirm,
  ]);

  useEffect(() => {
    const targetMap = {
      username: usernameCardRef.current,
      email: emailCardRef.current,
      password: passwordCardRef.current,
      delete: deleteCardRef.current,
    };
    const target = targetMap[openSettingsSection];
    if (!target) return;
    const id = setTimeout(() => scrollToSettingsCard(target), 0);
    return () => clearTimeout(id);
  }, [openSettingsSection, scrollToSettingsCard]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const btn = deleteConfirmRef.current;
    if (btn && btn.focus) btn.focus();
  }, [showDeleteConfirm]);
  useEffect(() => {
    if (showDeleteConfirm) setConfirmDeleteChecked(false);
  }, [showDeleteConfirm]);

  // TOASTS
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const isCitizen = loggedInUserRole === 'citizen';
  const isBrgy = loggedInUserRole === 'brgy';
  const roleConfig = roleCopy[isBrgy ? 'brgy' : 'citizen'];

  const sections = useMemo(
    () => [
      {
        id: 'devices',
        label: isBrgy ? 'Managed devices' : 'Your devices',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M13 9a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-10" />
            <path d="M18 8v-3a1 1 0 0 0 -1 -1h-13a1 1 0 0 0 -1 1v12a1 1 0 0 0 1 1h9" />
            <path d="M16 9h2" />
          </svg>
        ),
        description: isBrgy
          ? 'Check barangay-operated stations and their streaming status.'
          : 'View personal devices linked to your contributor account.',
      },
      {
        id: 'tools',
        label: isBrgy ? 'Tools & tokens' : 'Tools',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />
          </svg>
        ),
        description: isBrgy
          ? 'Access tokens for barangay ringservers.'
          : 'Contributor tools coming soon.',
        badge: isBrgy ? null : 'beta',
      },
      {
        id: 'account',
        label: 'Account settings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
            <path d="M6 21v-2a4 4 0 0 1 4 -4h2.5" />
            <path d="M17.001 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M19.001 15.5v1.5" />
            <path d="M19.001 21v1.5" />
            <path d="M22.032 17.25l-1.299 .75" />
            <path d="M17.27 20l-1.3 .75" />
            <path d="M15.97 17.25l1.3 .75" />
            <path d="M20.733 20l1.3 .75" />
          </svg>
        ),
        description: 'Manage your username, contact email, and password.',
        badge: passwordStatus === 'legacy' ? 'update' : null,
      },
    ],
    [isBrgy, passwordStatus],
  );

  const activeSectionMeta = sections.find((section) => section.id === activeSection);

  const overviewDevices = useMemo(() => {
    const normalizeKey = (value) => String(value || '').trim().toUpperCase();
    const buildKey = (entry, fallback) => {
      const network = normalizeKey(entry.network);
      const station = normalizeKey(entry.station);
      if (network || station) return `${network}|${station}`;
      return entry.deviceId || entry.streamId || entry.macAddress || fallback;
    };

    const linkedItems = (devices || []).map((device, index) => ({
      ...device,
      _overviewKey: buildKey(device, `linked-${index}`),
    }));

    const linkedKeys = new Set(linkedItems.map((item) => item._overviewKey));
    const releasedMap = new Map();

    (releasedDevices || []).forEach((entry, index) => {
      const key = buildKey(entry, `released-${index}`);
      if (linkedKeys.has(key)) return;
      const releasedAtValue = entry.releasedAt ? new Date(entry.releasedAt).getTime() : 0;
      const existing = releasedMap.get(key);
      if (!existing || releasedAtValue > existing.releasedAtValue) {
        releasedMap.set(key, {
          entry,
          releasedAtValue,
          key,
        });
      }
    });

    const releasedItems = Array.from(releasedMap.values()).map(({ entry, key }) => ({
      network: entry.network,
      station: entry.station,
      description: entry.description,
      streamId: entry.streamId,
      macAddress: entry.macAddress,
      activity: 'unlinked',
      status: 'Unlinked',
      statusSince: entry.releasedAt || null,
      activityToggleTime: entry.releasedAt || null,
      _overviewKey: key,
    }));

    return [...linkedItems, ...releasedItems];
  }, [devices, releasedDevices]);

  const statusCounts = useMemo(() => {
    const summary = { streaming: 0, inactive: 0, unlinked: 0 };
    (overviewDevices || []).forEach((device) => {
      const state = normalizeDeviceActivity(device.activity || device.status);
      if (state === 'active') summary.streaming += 1;
      else if (state === 'unlinked') summary.unlinked += 1;
      else summary.inactive += 1;
    });
    return summary;
  }, [overviewDevices]);

  const sortedOverviewDevices = useMemo(() => {
    const statusRank = {
      streaming: 0,
      'not streaming': 1,
      'not yet linked': 1,
      unlinked: 2,
    };
    const getRank = (label) => statusRank[String(label || '').toLowerCase()] ?? 99;
    const toTimeValue = (value) => {
      const m = moment(value);
      if (!m.isValid()) return -Infinity;
      const v = m.valueOf();
      return v > 0 ? v : -Infinity;
    };

    return [...(overviewDevices || [])]
      .map((device, index) => {
        const statusLabel = toDashboardStatusLabel({
          activity: device.activity,
          status: device.status,
        });
        return {
          device,
          statusLabel,
          rank: getRank(statusLabel),
          sinceValue: toTimeValue(device.statusSince || device.activityToggleTime),
          index,
        };
      })
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.sinceValue !== b.sinceValue) return b.sinceValue - a.sinceValue;
        return (a.device.station || '').localeCompare(b.device.station || '');
      });
  }, [overviewDevices]);

  const hasDevices = (devices || []).length > 0;
  const hasOverviewDevices = (overviewDevices || []).length > 0;
  const hasLinkedDevices = devicesFetched ? hasDevices : true;
  const linkedDeviceCount = devicesFetched ? (devices || []).length : '…';
  const deleteActionLabel = hasLinkedDevices
    ? devicesFetched
      ? 'Unlink devices first'
      : 'Checking devices...'
    : 'Delete';
  const emptyState = roleConfig.empty;

  useEffect(() => {
    setEmailForm((prev) => ({ ...prev, email: accountEmail || '' }));
  }, [accountEmail]);

  useEffect(() => {
    if (isCitizen || isBrgy) fetchDevices();
  }, [isCitizen, isBrgy]);

  const fetchDevices = async () => {
    try {
      // Read API host from runtime env (no defaults; .env expected to be configured)
      const backend_host = backendHost();
      axios.defaults.withCredentials = true;
      const response = await axios.get(`${backend_host}/device/my-devices`, {
        validateStatus: (status) => status < 500, // prevent thrown errors for 4xx
      });
      if (!isMountedRef.current) return;
      if (response.status === 200) {
        setDevices(response.data.devices || []);
        setReleasedDevices(response.data.releasedDevices || []);
      } else {
        // For 401/403 or other handled statuses, clear list silently
        setDevices([]);
        setReleasedDevices([]);
      }
    } catch (error) {
      // Suppress expected auth errors to keep console clean; UI remains the same
      const status = error?.response?.status;
      if (status === 401 || status === 403) return; // keep devices as []
      // Log unexpected errors for debugging
      if (isMountedRef.current) deverror('Error fetching devices:', error);
    } finally {
      if (isMountedRef.current) setDevicesFetched(true);
    }
  };

  const applyDeviceStatusUpdate = useCallback((raw) => {
    try {
      const code = String(
        raw.stationCode || raw.station || raw.code || raw.station_id || raw.stationcode || '',
      ).toUpperCase();
      const network = String(
        raw.network || raw.networkCode || raw.network_code || raw.net || 'AM',
      ).toUpperCase();
      if (!code || !network) return;
      const state = normalizeDeviceActivity(raw.activity || raw.status || '');
      const statusSince =
        raw.statusSince ||
        raw.status_since ||
        raw.timestamp ||
        raw.time ||
        raw.lastActive ||
        raw.activityToggleTime ||
        null;

      setDevices((prev) => {
        let changed = false;
        const next = prev.map((dev) => {
          if (
            String(dev.station || '').toUpperCase() !== code ||
            String(dev.network || 'AM').toUpperCase() !== network
          ) {
            return dev;
          }
          const nextActivity = state || dev.activity || dev.status;
          const nextStatus = toDashboardStatusLabel({
            activity: nextActivity,
            status: raw.status || dev.status,
          });
          const nextSince = statusSince || dev.statusSince || dev.activityToggleTime || null;
          changed = true;
          return {
            ...dev,
            activity: nextActivity,
            status: nextStatus,
            statusSince: nextSince,
            activityToggleTime: nextSince,
          };
        });
        return changed ? next : prev;
      });
    } catch (_) {}
  }, []);

  const bindDashboardSSE = useCallback(() => {
    if (eventSourceRef.current) return eventSourceRef.current;
    const url = `${backendHost()}/messaging`;
    try {
      const src = new EventSource(url);
      const handler = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyDeviceStatusUpdate(data);
        } catch (_) {}
      };
      const names = [
        'STATION_STATUS',
        'SC_STATION_STATUS',
        'SC_STATION',
        'SC_DEVICE',
        'DEVICE_STATUS',
        'STATION_EVENT',
      ];
      names.forEach((n) => src.addEventListener(n, handler));
      src.addEventListener('error', () => {});
      eventSourceRef.current = { src, names, handler };
    } catch (_) {
      eventSourceRef.current = null;
    }
    return eventSourceRef.current;
  }, [applyDeviceStatusUpdate]);

  useEffect(() => {
    if (!isCitizen && !isBrgy) return undefined;
    const bound = bindDashboardSSE();
    return () => {
      try {
        if (bound && bound.src) {
          bound.names?.forEach((n) => bound.src.removeEventListener(n, bound.handler));
          bound.src.close && bound.src.close();
        }
      } catch (_) {}
      eventSourceRef.current = null;
    };
  }, [bindDashboardSSE, isCitizen, isBrgy]);

  // Unified close handler with exit animation
  const handleClose = useCallback((_reason = 'backdrop') => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    const el = dashboardContainerRef.current;
    if (el && el.animate) {
      const anim = el.animate(
        [
          { opacity: 1, transform: 'translateX(0)' },
          { opacity: 0, transform: 'translateX(100%)' },
        ],
        { duration: 150, easing: 'cubic-bezier(0, 0, 0.5, 1)', fill: 'forwards' },
      );
      anim.onfinish = () => {
        try {
          (onEscapeClick || onClick)?.();
        } finally {
          isClosingRef.current = false;
        }
      };
      return;
    }
    // Fallback: no WAAPI
    (onEscapeClick || onClick)?.();
    isClosingRef.current = false;
  }, [onClick, onEscapeClick]);

  useEffect(() => {
    isMountedRef.current = true;
    const dashboardContainerEl = dashboardContainerRef.current;
    dashboardContainerEl.animate(
      [
        { opacity: 0, transform: 'translateX(100%)' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)',
        fill: 'both',
      },
    );

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleClose('escape');
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      isMountedRef.current = false;
      try { timeoutsRef.current.forEach((t) => clearTimeout(t)); } catch (_) {}
      timeoutsRef.current = [];
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  // Focus trap inside the dashboard dialog for accessibility
  useEffect(() => {
    const root = dashboardContainerRef.current;
    if (!root) return undefined;
    const getFocusables = () =>
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const focusFirst = () => {
      const f = getFocusables();
      if (f && f.length) {
        const el = f[0];
        if (el && typeof el.focus === 'function') el.focus();
      }
    };
    focusFirst();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const f = getFocusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', trap);
    return () => root.removeEventListener('keydown', trap);
  }, []);

  useEffect(() => {
    switch (pageTransition) {
      case 0: // Initial state
        profileRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(100%)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          {
            duration: 150,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both',
          },
        );
        break;

      case 1: // Other to DeviceList (where Other is any other dashboard view, and DeviceList/Profile is the main view)
        profileRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(-100%)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both',
          },
        );
        break;

      case 2: // DeviceList to AddDevice
        addDeviceFormRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(100%)' }, // Updated transform property
            { opacity: 1, transform: 'translateX(0%)' }, // Updated transform property
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both',
          },
        );
        break;

      default:
        console.error(`pageTransition of value ${pageTransition} not handled!`);
    }
  }, [pageTransition]);

  async function handleAddDeviceSubmit(event) {
    event.preventDefault();
    // Read API host from runtime env (no defaults; .env expected to be configured)
    const backend_host = backendHost();

    const network = event.target.elements.network.value;
    const station = event.target.elements.station.value;
    const longitude = event.target.elements.longitude.value;
    const latitude = event.target.elements.latitude.value;
    const elevation = event.target.elements.elevation.value;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/device/add`, {
        network: network,
        station: station,
        longitude: longitude,
        latitude: latitude,
        elevation: elevation,
      });

      if (!isMountedRef.current) return;
      if (response.data.status === responseCodes.GENERIC_SUCCESS) {
        devlog('Add Device Success');

        // Set toast message
        setToastMessage('Device added. Visit rs.local:3000 to link device.');
        setToastType('success');

        // Auto-dismiss after 60s (longer so users can read and act)
        scheduleToastClear(60000);

        setPageTransition(1);
        fetchDevices(); // call fetchDevices() to update the device list table (should reload the table content with the successfully added device)
      } else {
        devlog('Something went wrong in submitting add-device request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(`Error: ${data.message}`);
          setToastType('error');
        }
        scheduleToastClear(5000);

        deverror('Error occurred while adding device:', data);
      } else {
        if (isMountedRef.current) {
          setToastMessage(`Network Error`);
          setToastType('error');
        }
        scheduleToastClear(5000);

        deverror('Error occurred while adding device:', error);
      }
    }
  }

  async function requestTokenSubmit(event) {
    event.preventDefault();
    // Read API host from runtime env (no defaults; .env expected to be configured)
    const backend_host = backendHost();
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/acquire-brgy-token`);
      devlog('Brgy access token acquired', response.data);

      const decodedToken = jwtDecode(response.data.accessToken);

      const currentMoment = moment(); // Get the current moment
      const expiryTimeStamp = new Date(decodedToken.exp * 1000); // Convert seconds to milliseconds
      const expiryMoment = moment(expiryTimeStamp); // Moment object for the expiry date
      const remainingTime = moment.duration(expiryMoment.diff(currentMoment));

      devlog('Token Expiry: ', remainingTime.days());

      if (isMountedRef.current) {
        setAccessTokenExpiry(formatAccessTokenExpiry(remainingTime)); // human-friendly expiry
        setBrgyAccessToken(response.data.accessToken); // set brgyAccessToken value
        setToastMessage('Brgy access token request success');
        setToastType('success');
      }
    } catch (error) {
      deverror(error);

      if (isMountedRef.current) {
        setToastMessage(`Brgy access token request error`);
        setToastType('error');
      }
    }

    scheduleToastClear(5000);
  }

  const textRef = useRef(null);

  function copyText() {
    try {
      if (!textRef.current.innerText) {
        throw new Error('Clipboard is empty. Request a token first.');
      }

      const textToCopy = textRef.current.innerText;
      navigator.clipboard.writeText(textToCopy);
      devlog('Text copied to clipboard:', textToCopy);

      setToastMessage('Access Token copied to clipboard');
      setToastType('success');
    } catch (error) {
      deverror('Failed to copy text:', error);

      setToastMessage('Failed to copy text');
      setToastType('error');
    }

    scheduleToastClear(5000);
  }

  const validateEmailForm = () => {
    const nextErrors = {};
    const trimmedEmail = (emailForm.email || '').trim();
    const emailChanged = Boolean(trimmedEmail) && trimmedEmail !== (accountEmail || '');

    if (!emailChanged) {
      nextErrors.email = 'Enter a new contact email to update.';
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!emailForm.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    setEmailErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      scheduleToastClear(6000);
      return null;
    }

    return { email: trimmedEmail, currentPassword: emailForm.currentPassword };
  };

  async function handleEmailSubmit(event) {
    event.preventDefault();
    const payload = validateEmailForm();
    if (!payload) return;
    setIsUpdatingEmail(true);
    try {
      axios.defaults.withCredentials = true;
      const backend_host = backendHost();
      await axios.patch(`${backend_host}/accounts/email`, payload);
      if (!isMountedRef.current) return;
      setToastMessage('Email updated.');
      setToastType('success');
      setEmailErrors({});
      setEmailForm((prev) => ({
        ...prev,
        email: payload.email,
        currentPassword: '',
      }));
      setOpenSettingsSection(null);
      scheduleToastClear(6000);
      if (typeof onProfileRefresh === 'function') onProfileRefresh();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data?.message || 'Unable to update email.');
          setToastType('error');
          const m = String(data?.message || '').toLowerCase();
          const next = {};
          if (m.includes('email')) next.email = true;
          if (m.includes('current password')) next.currentPassword = true;
          setEmailErrors(next);
          scheduleToastClear(6000);
        }
      } else {
        if (isMountedRef.current) {
          setToastMessage('Unable to update email right now.');
          setToastType('error');
          scheduleToastClear(6000);
        }
      }
      deverror('Error updating account email:', error?.response || error);
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingEmail(false);
      }
    }
  }

  const validateUsernameForm = () => {
    const nextErrors = {};
    const trimmedUsername = (usernameForm.newUsername || '').trim();
    if (!trimmedUsername || trimmedUsername === (loggedInUser || '')) {
      nextErrors.newUsername = 'Enter a new username to update.';
    } else {
      const usernameIssue = describeUsernameIssue(trimmedUsername);
      if (usernameIssue) nextErrors.newUsername = usernameIssue;
    }
    if (!usernameForm.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    setUsernameErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      scheduleToastClear(6000);
      return null;
    }

    return { newUsername: trimmedUsername, currentPassword: usernameForm.currentPassword };
  };

  async function handleUsernameSubmit(event) {
    event.preventDefault();
    const payload = validateUsernameForm();
    if (!payload) return;
    setIsUpdatingUsername(true);
    try {
      axios.defaults.withCredentials = true;
      const backend_host = backendHost();
      await axios.patch(`${backend_host}/accounts/username`, payload);
      if (!isMountedRef.current) return;
      setToastMessage('Username updated.');
      setToastType('success');
      setUsernameErrors({});
      setUsernameForm((prev) => ({
        ...prev,
        newUsername: payload.newUsername,
        currentPassword: '',
      }));
      setOpenSettingsSection(null);
      scheduleToastClear(6000);
      if (typeof onProfileRefresh === 'function') onProfileRefresh();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data?.message || 'Unable to update username.');
          setToastType('error');
          const m = String(data?.message || '').toLowerCase();
          const next = {};
          if (m.includes('username')) next.newUsername = true;
          if (m.includes('password')) next.currentPassword = true;
          setUsernameErrors(next);
          scheduleToastClear(6000);
        }
      } else if (isMountedRef.current) {
        setToastMessage('Unable to update username right now.');
        setToastType('error');
        scheduleToastClear(6000);
      }
      deverror('Error updating account username:', error?.response || error);
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingUsername(false);
      }
    }
  }

  const validatePasswordForm = () => {
    const nextErrors = {};
    const passwordChanged = Boolean(passwordForm.newPassword);

    if (!passwordChanged) {
      nextErrors.form = 'Enter a new password to update.';
    }

    if (passwordChanged) {
      const passwordIssue = describeAccountPasswordIssue(passwordForm.newPassword);
      if (passwordIssue) nextErrors.newPassword = passwordIssue;
      if (passwordForm.confirmPassword !== passwordForm.newPassword) {
        nextErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (passwordChanged && !passwordForm.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      scheduleToastClear(6000);
      return null;
    }

    return {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    };
  };

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const payload = validatePasswordForm();
    if (!payload) return;
    setIsUpdatingPassword(true);
    try {
      axios.defaults.withCredentials = true;
      const backend_host = backendHost();
      await axios.patch(`${backend_host}/accounts/password`, payload);
      if (!isMountedRef.current) return;
      setToastMessage('Password updated.');
      setToastType('success');
      setPasswordErrors({});
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setOpenSettingsSection(null);
      scheduleToastClear(6000);
      if (typeof onProfileRefresh === 'function') onProfileRefresh();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data?.message || 'Unable to update password.');
          setToastType('error');
          const m = String(data?.message || '').toLowerCase();
          const next = {};
          if (m.includes('current password')) next.currentPassword = true;
          if (m.includes('password')) next.newPassword = true;
          if (m.includes('match')) next.confirmPassword = true;
          setPasswordErrors(next);
          scheduleToastClear(6000);
        }
      } else {
        if (isMountedRef.current) {
          setToastMessage('Unable to update password right now.');
          setToastType('error');
          scheduleToastClear(6000);
        }
      }
      deverror('Error updating account password:', error?.response || error);
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingPassword(false);
      }
    }
  }

  async function handleDeleteAccount() {
    if (hasLinkedDevices) {
      setToastMessage('Unlink and reset all devices via rs.local:3000 before deleting this account.');
      setToastType('error');
      scheduleToastClear(6000);
      return;
    }
    setIsDeletingAccount(true);
    try {
      axios.defaults.withCredentials = true;
      const backend_host = backendHost();
      await axios.delete(`${backend_host}/accounts`);
      if (!isMountedRef.current) return;
      setToastMessage('Account deleted.');
      setToastType('success');
      scheduleToastClear(4000);
      if (typeof onSignoutSuccess === 'function') onSignoutSuccess();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data?.message || 'Unable to delete account.');
          setToastType('error');
          if (data?.status === responseCodes.ACCOUNT_DELETE_HAS_DEVICES) {
            setOpenSettingsSection('delete');
          }
          scheduleToastClear(7000);
        }
      } else if (isMountedRef.current) {
        setToastMessage('Unable to delete account right now.');
        setToastType('error');
        scheduleToastClear(6000);
      }
      deverror('Error deleting account:', error?.response || error);
    } finally {
      if (isMountedRef.current) {
        setIsDeletingAccount(false);
        setShowDeleteConfirm(false);
      }
    }
  }

  /* Comment out for now (remove add device option)
  function handleAddDeviceClick() {
    setPageTransition(2);
  }
  */

  function handleCancelClick() {
    setPageTransition(1);
  }

  async function handleSignout() {
    const backend_host =
      process.env.NODE_ENV === 'production'
        ? window['ENV'].REACT_APP_BACKEND
        : window['ENV'].REACT_APP_BACKEND_DEV;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/signout`);

      if (response.data.status === responseCodes.SIGNOUT_SUCCESS) {
        devlog('Sign out successful!');
        onSignoutSuccess();
      } else {
        devlog('Something went wrong in submitting sign-out request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data.message);
          setToastType('error');
        }
        deverror('Error occurred while signing out:', data);
      } else {
        deverror('Error occurred while signing out:', error);
      }
    }
  }

  // handleClose defined above with useCallback

  const content = (
    <div className={styles.modalOverlay}>
      <div
        ref={dashboardContainerRef}
        id="dashboard-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-title"
        className={`${styles.dashboardModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Toast
          message={toastMessage}
          toastType={toastType}
          placement="global"
          onClose={() => setToastMessage('')}
        />

        {pageTransition < 2 && (
        <div ref={profileRef} className={styles.profileContainer}>
          <div className={styles.contextHeader}>
            <div className={styles.headerText}>
              <p className={styles.overline}>{roleConfig.overline}</p>
              <div className={styles.titleRow}>
                <h2
                  id="dashboard-title"
                  className={styles.topBarTitle}
                  title={`${loggedInUser || 'Contributor'} workspace`}
                >
                  {roleConfig.title}
                </h2>
                <span
                  className={`${styles.rolePill} ${isBrgy ? styles.rolePillBrgy : styles.rolePillCitizen}`}
                >
                  {isBrgy ? 'Barangay operator' : 'Citizen scientist'}
                </span>
              </div>
              <div className={styles.sectionNav} role="tablist" aria-label="Dashboard sections">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === section.id}
                    className={`${styles.sectionTab} ${
                      activeSection === section.id ? styles.sectionTabActive : ''
                    }`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <span className={styles.sectionTabIcon} aria-hidden="true">
                      {section.icon}
                    </span>
                    <span className={styles.sectionTabLabel}>{section.label}</span>
                    {section.badge && <span className={styles.sectionTabBadge}>{section.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.actionStack} role="toolbar" aria-label="Dashboard actions">
              <div className={styles.signedInMeta}>
                Signed in as <span className={styles.boldText}>{loggedInUser || 'Contributor'}</span>
              </div>
              <div className={styles.topBarTools}>
                <button
                  type="button"
                  className={`${styles.toolBtn} ${styles.actionBtn}`}
                  onClick={handleSignout}
                  title="Sign out of your account"
                  aria-label="Sign out"
                >
                  <SignOutIcon className={styles.actionIcon} />
                  <span className={styles.actionLabel}>Sign out</span>
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => handleClose('close')}
                  aria-label="Close dashboard"
                  title="Close"
                >
                  <CloseIcon className={styles.actionIcon} />
                </button>
              </div>
            </div>
          </div>

          <div ref={profileScrollRef} className={styles.profileScroll}>
            {passwordStatus === 'legacy' && (
              <div className={styles.passwordNotice} role="status" aria-live="polite">
                <div>
                  <div className={styles.noticeTitleRow}>
                    <p className={`${styles.noticeTitle} ${styles.noticeTitleInline}`}>Password update recommended</p>
                    <InfoTooltip label="Password update details" title="Why update?" variant="inline">
                      This account uses an older password. Update it in Account settings when convenient.
                    </InfoTooltip>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.toolBtn} ${styles.noticeAction} ${styles.actionBtn} ${styles.collapseLabel}`}
                  onClick={handleOpenPasswordSettings}
                  aria-label="Open account settings"
                >
                  <SettingsIcon className={styles.actionIcon} />
                  <span className={styles.actionLabel}>Open settings</span>
                </button>
              </div>
            )}

            {activeSectionMeta?.description && (
              <p className={styles.sectionDescription}>{activeSectionMeta.description}</p>
            )}

            {activeSection === 'devices' && (
              <div className={styles.sectionGridSingle}>
                <section className={styles.panelBody} aria-label="Device overview">
                  <div className={styles.panelHeaderRow}>
                    <div>
                      <p className={styles.panelKicker}>Connectivity</p>
                      <div className={styles.panelTitleRow}>
                        <h3 className={styles.panelTitle}>Device overview</h3>
                        <InfoTooltip label="Device overview details" title="Connectivity overview" variant="inline">
                          {roleConfig.devicesIntro}
                        </InfoTooltip>
                      </div>
                    </div>
                    <div className={styles.summaryPills} aria-label="Device status summary">
                      <span className={`${styles.summaryPill} ${styles.summaryPillPositive}`}>
                        Streaming <strong>{statusCounts.streaming}</strong>
                      </span>
                      <span className={`${styles.summaryPill} ${styles.summaryPillWarning}`}>
                        Not Streaming <strong>{statusCounts.inactive}</strong>
                      </span>
                      <span className={`${styles.summaryPill} ${styles.summaryPillMuted}`}>
                        Unlinked <strong>{statusCounts.unlinked}</strong>
                      </span>
                    </div>
                  </div>

                  <div className={styles.deviceListTableContainer}>
                    <table className={styles.deviceListTable}>
                      <thead>
                        <tr>
                          <th scope="col">Network</th>
                          <th scope="col">Station</th>
                          <th scope="col">Status</th>
                          <th scope="col">Status since</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hasOverviewDevices ? (
                          sortedOverviewDevices.map(({ device, statusLabel, index }) => {
                            const statusVariant = getStatusVariant(statusLabel);
                            const badgeClass =
                              statusVariant === 'ok'
                                ? styles.statusBadgeOk
                                : statusVariant === 'warn'
                                  ? styles.statusBadgeWarn
                                  : styles.statusBadgeMuted;
                            const key = `${device.network || 'net'}-${device.station || index}-${index}`;
                            return (
                              <tr key={key}>
                                <td>
                                  <div className={styles.cellHeading}>{device.network || '—'}</div>
                                </td>
                                <td>
                                  <div className={styles.cellHeadingRow}>
                                    <div className={styles.cellHeading}>{device.station || '—'}</div>
                                    {device.description && (
                                      <InfoTooltip
                                        label={`${device.station || 'Station'} details`}
                                        title="Station details"
                                        variant="inline"
                                      >
                                        {device.description}
                                      </InfoTooltip>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className={`${styles.statusBadge} ${badgeClass}`}
                                    title={statusTooltips[statusLabel] || statusLabel}
                                  >
                                    {statusLabel}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles.sinceLabel} title={device.statusSince || ''}>
                                    {formatStatusSince(device.statusSince)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="4">
                              <div className={styles.emptyState}>
                                <div className={styles.emptyTitleRow}>
                                  <p className={`${styles.emptyTitle} ${styles.emptyTitleInline}`}>
                                    {emptyState.title}
                                  </p>
                                  <InfoTooltip label={`${emptyState.title} details`} title="Getting started" variant="inline">
                                    {renderEmptyStateDetails(emptyState)}
                                  </InfoTooltip>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeSection === 'tools' && (
              <div className={styles.sectionGridSingle}>
                {isBrgy ? (
                  <section className={styles.panelBody} aria-label="Access tokens">
                    <div className={styles.panelHeaderRow}>
                    <div>
                      <p className={styles.panelKicker}>Access control</p>
                      <div className={styles.panelTitleRow}>
                        <h3 className={styles.panelTitle}>Tokens & credentials</h3>
                        <InfoTooltip label="Tokens and credentials details" title="Access control" variant="inline">
                          Generate a token for barangay ringservers to access the UPRI network.
                        </InfoTooltip>
                      </div>
                    </div>
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={`${styles.toolBtn} ${styles.requestTokenBtn}`}
                          onClick={requestTokenSubmit}
                          title="Request barangay access token"
                          aria-label="Request barangay access token"
                        >
                          Request token
                        </button>
                      </div>
                    </div>

                    <div className={styles.tokenCard}>
                      {brgyAccessToken ? (
                        <>
                          <div className={styles.tokenRow}>
                            <p className={styles.tokenLabel}>Barangay access token</p>
                            <span className={styles.tokenExpiry}>
                              Valid for {accessTokenExpiry ?? '—'}
                            </span>
                          </div>
                          <p className={styles.tokenValue} ref={textRef}>
                            {brgyAccessToken}
                          </p>
                          <div className={styles.tokenActions}>
                            <button
                              type="button"
                              className={`${styles.toolBtn} ${styles.copyTokenBtn}`}
                              onClick={copyText}
                              title="Copy token to clipboard"
                              aria-label="Copy token to clipboard"
                            >
                              Copy token
                            </button>
                            <small className={styles.tokenNote}>
                              Store this token securely. Rotate it before expiry and update your
                              ringserver configuration to keep forwarding data.
                            </small>
                          </div>
                        </>
                    ) : (
                      <div className={styles.tokenPlaceholder}>
                        <div className={styles.emptyTitleRow}>
                          <p className={`${styles.emptyTitle} ${styles.emptyTitleInline}`}>
                            No token generated yet
                          </p>
                          <InfoTooltip label="Token placeholder details" title="How to generate a token" variant="inline">
                            Use “Request token” to generate credentials for your barangay devices. The
                            token will appear here once created.
                          </InfoTooltip>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                ) : (
                  <section className={`${styles.panelBody} ${styles.futurePanel}`} aria-label="Contributor tools">
                    <div className={styles.panelHeaderRow}>
                      <div>
                        <p className={styles.panelKicker}>Tools</p>
                        <h3 className={styles.panelTitle}>Contributor tools</h3>
                        <p className={styles.panelSubtitle}>
                          No tools available yet. Linking devices is handled by your sender software.
                        </p>
                      </div>
                    </div>
                    <div className={styles.tokenPlaceholder}>
                      <p className={styles.emptyTitle}>No tools yet</p>
                      <p className={styles.emptyBody}>
                        This space will host contributor utilities when they launch.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeSection === 'account' && (
              <div className={styles.sectionGridSingle}>
                <section className={styles.panelBody} aria-label="Account settings">
                <div className={styles.panelHeaderRow}>
                  <div>
                    <p className={styles.panelKicker}>Account</p>
                    <div className={styles.panelTitleRow}>
                      <h3 className={styles.panelTitle}>Account settings</h3>
                      <InfoTooltip label="Account settings details" title="Account settings" variant="inline">
                        Manage your username, contact email, password, or delete your account when safe.
                      </InfoTooltip>
                    </div>
                  </div>
                </div>

                  <div className={styles.accountSummary}>
                    <div className={styles.metaItem}>
                      <div className={styles.metaHeader}>
                        <p className={styles.metaLabel}>Username</p>
                        <button
                          type="button"
                          className={`${styles.metaEdit} ${
                            openSettingsSection === 'username' ? styles.metaEditActive : ''
                          }`}
                          onClick={() => toggleSettingsSection('username')}
                          aria-expanded={openSettingsSection === 'username'}
                          aria-controls="username-settings-card"
                        >
                          <PencilIcon className={styles.actionIcon} />
                          <span className={styles.buttonLabel}>Edit</span>
                        </button>
                      </div>
                      <p className={styles.metaValue}>{loggedInUser || '—'}</p>
                    </div>
                    <div className={styles.metaItem}>
                      <p className={styles.metaLabel}>Role</p>
                      <p className={styles.metaValue}>
                        {isBrgy ? 'Barangay operator' : 'Citizen scientist'}
                      </p>
                    </div>
                    <div className={styles.metaItem}>
                      <div className={styles.metaHeader}>
                        <p className={styles.metaLabel}>Contact email</p>
                        <button
                          type="button"
                          className={`${styles.metaEdit} ${
                            openSettingsSection === 'email' ? styles.metaEditActive : ''
                          }`}
                          onClick={() => toggleSettingsSection('email')}
                          aria-expanded={openSettingsSection === 'email'}
                          aria-controls="email-settings-card"
                        >
                          <PencilIcon className={styles.actionIcon} />
                          <span className={styles.buttonLabel}>Edit</span>
                        </button>
                      </div>
                      <p className={styles.metaValue}>{accountEmail || 'Not set'}</p>
                    </div>
                  </div>

                  {(openSettingsSection === 'username' || openSettingsSection === 'email') && (
                    <div className={styles.accountStack}>
                      {openSettingsSection === 'username' && (
                        <div
                          className={styles.settingsCard}
                          id="username-settings-card"
                          aria-label="Update username"
                          ref={usernameCardRef}
                        >
                          <div className={styles.cardHeaderRow}>
                            <div>
                              <p className={styles.panelKicker}>Username</p>
                              <div className={styles.cardTitleRow}>
                                <h4 className={styles.cardTitle}>Update username</h4>
                                <InfoTooltip label="Username update details" title="Why update?" variant="inline">
                                  Change your username and keep your devices labeled correctly.
                                </InfoTooltip>
                              </div>
                            </div>
                            <button
                              type="button"
                            className={`${styles.settingsToggle} ${
                              openSettingsSection === 'username' ? styles.settingsToggleActive : ''
                            }`}
                            onClick={() => toggleSettingsSection(null)}
                            aria-label="Hide username editor"
                          >
                            Hide
                          </button>
                        </div>
                          <form className={styles.accountSettingsForm} onSubmit={handleUsernameSubmit} noValidate>
                            <div className={styles.settingsRow}>
                              <label className={styles.settingsField} htmlFor="account-username-new">
                                New username
                                <input
                                  id="account-username-new"
                                  type="text"
                                  name="newUsername"
                                  autoComplete="username"
                                  value={usernameForm.newUsername}
                                  placeholder="Enter new username"
                                  className={`${styles.settingsInput} ${
                                    usernameErrors.newUsername ? styles.inputError : ''
                                  }`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setUsernameForm((prev) => ({ ...prev, newUsername: value }));
                                    setUsernameErrors((prev) => ({ ...prev, newUsername: false, form: false }));
                                  }}
                                />
                              </label>
                            </div>
                            <div className={styles.settingsRow}>
                              <label className={styles.settingsField} htmlFor="account-username-current-password">
                                Current password
                                <div className={styles.passwordField}>
                                  <input
                                    id="account-username-current-password"
                                    type={passwordVisibility.usernameCurrent ? 'text' : 'password'}
                                    name="currentPassword"
                                    autoComplete="current-password"
                                    value={usernameForm.currentPassword}
                                    placeholder="Enter current password"
                                    className={`${styles.settingsInput} ${
                                      usernameErrors.currentPassword ? styles.inputError : ''
                                    }`}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setUsernameForm((prev) => ({ ...prev, currentPassword: value }));
                                      setUsernameErrors((prev) => ({
                                        ...prev,
                                        currentPassword: false,
                                        form: false,
                                      }));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.eyeToggle}
                                    aria-label={`${
                                      passwordVisibility.usernameCurrent ? 'Hide' : 'Show'
                                    } current password`}
                                    aria-pressed={passwordVisibility.usernameCurrent}
                                    onClick={() =>
                                      setPasswordVisibility((prev) => ({
                                        ...prev,
                                        usernameCurrent: !prev.usernameCurrent,
                                      }))
                                    }
                                  >
                                    <EyeIcon revealed={passwordVisibility.usernameCurrent} />
                                  </button>
                                </div>
                              </label>
                            </div>
                            <div className={styles.settingsActions}>
                              <button type="submit" className={styles.saveButton} disabled={isUpdatingUsername}>
                                {isUpdatingUsername ? 'Updating...' : 'Save username'}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {openSettingsSection === 'email' && (
                        <div
                          className={styles.settingsCard}
                          id="email-settings-card"
                          aria-label="Update contact email"
                          ref={emailCardRef}
                        >
                          <div className={styles.cardHeaderRow}>
                            <div>
                              <p className={styles.panelKicker}>Contact email</p>
                              <div className={styles.cardTitleRow}>
                                <h4 className={styles.cardTitle}>Update contact email</h4>
                                <InfoTooltip label="Contact email details" title="Why update?" variant="inline">
                                  Used for notices, resets, and security updates.
                                </InfoTooltip>
                              </div>
                            </div>
                            <button
                              type="button"
                            className={`${styles.settingsToggle} ${
                              openSettingsSection === 'email' ? styles.settingsToggleActive : ''
                            }`}
                            onClick={() => toggleSettingsSection(null)}
                            aria-label="Hide email editor"
                          >
                            Hide
                          </button>
                        </div>
                          <form className={styles.accountSettingsForm} onSubmit={handleEmailSubmit} noValidate>
                            <div className={styles.settingsRow}>
                          <label className={styles.settingsField} htmlFor="account-email">
                                <span className={formStyles.fieldLabelRow}>
                                  Contact email
                                </span>
                                <input
                                  id="account-email"
                                  type="email"
                                  name="email"
                                  autoComplete="email"
                                  value={emailForm.email}
                                  placeholder="you@example.com"
                                  className={`${styles.settingsInput} ${emailErrors.email ? styles.inputError : ''}`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setEmailForm((prev) => ({ ...prev, email: value }));
                                    setEmailErrors((prev) => ({ ...prev, email: false, form: false }));
                                  }}
                                />
                              </label>
                            </div>
                            <div className={styles.settingsRow}>
                              <label className={styles.settingsField} htmlFor="account-email-current-password">
                                Current password
                                <div className={styles.passwordField}>
                                  <input
                                    id="account-email-current-password"
                                    type={passwordVisibility.emailCurrent ? 'text' : 'password'}
                                    name="currentPassword"
                                    autoComplete="current-password"
                                    value={emailForm.currentPassword}
                                    placeholder="Enter current password"
                                    className={`${styles.settingsInput} ${
                                      emailErrors.currentPassword ? styles.inputError : ''
                                    }`}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setEmailForm((prev) => ({ ...prev, currentPassword: value }));
                                      setEmailErrors((prev) => ({
                                        ...prev,
                                        currentPassword: false,
                                        form: false,
                                      }));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.eyeToggle}
                                    aria-label={`${passwordVisibility.emailCurrent ? 'Hide' : 'Show'} current password`}
                                    aria-pressed={passwordVisibility.emailCurrent}
                                    onClick={() =>
                                      setPasswordVisibility((prev) => ({
                                        ...prev,
                                        emailCurrent: !prev.emailCurrent,
                                      }))
                                    }
                                  >
                                    <EyeIcon revealed={passwordVisibility.emailCurrent} />
                                  </button>
                                </div>
                              </label>
                            </div>
                            <div className={styles.settingsActions}>
                              <button type="submit" className={styles.saveButton} disabled={isUpdatingEmail}>
                                {isUpdatingEmail ? 'Updating...' : 'Save email'}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}

                      <div className={styles.accountStack}>
                        <div className={styles.settingsCard} aria-label="Password" ref={passwordCardRef}>
                          <div className={styles.cardHeaderRow}>
                            <div>
                              <div className={styles.kickerRow}>
                                <p className={styles.panelKicker}>Password</p>
                                <span
                                  className={`${styles.statusPill} ${
                                    passwordStatus === 'legacy' ? styles.statusPillWarn : styles.statusPillOk
                                  }`}
                                  title={`Password policy version ${passwordPolicyVersion || 'legacy'}`}
                                >
                                  {passwordStatus === 'legacy' ? 'Legacy' : 'Secure'}
                                </span>
                              </div>
                              <div className={styles.cardTitleRow}>
                                <h4 className={styles.cardTitle}>Update password</h4>
                                <InfoTooltip label="Password requirements" title="Password requirements" variant="inline">
                                  Minimum 12 characters. Letters, numbers, and symbols allowed.
                                </InfoTooltip>
                              </div>
                            </div>
                            <div className={styles.cardHeaderActions}>
                              <button
                          type="button"
                          className={`${styles.settingsToggle} ${
                            openSettingsSection === 'password' ? styles.settingsToggleActive : ''
                          }`}
                          onClick={() => toggleSettingsSection('password')}
                          aria-expanded={openSettingsSection === 'password'}
                          aria-controls="password-settings"
                        >
                          {openSettingsSection === 'password' ? 'Close' : 'Change'}
                        </button>
                            </div>
                            </div>
                            {openSettingsSection === 'password' && (
                            <form className={styles.accountSettingsForm} id="password-settings" onSubmit={handlePasswordSubmit} noValidate>
                          <div className={styles.settingsRow}>
                            <label className={styles.settingsField} htmlFor="account-current-password">
                              Current password
                              <div className={styles.passwordField}>
                                <input
                                  id="account-current-password"
                                  type={passwordVisibility.currentPassword ? 'text' : 'password'}
                                  name="currentPassword"
                                  autoComplete="current-password"
                                  value={passwordForm.currentPassword}
                                  placeholder="Enter current password"
                                  className={`${styles.settingsInput} ${
                                    passwordErrors.currentPassword ? styles.inputError : ''
                                  }`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPasswordForm((prev) => ({ ...prev, currentPassword: value }));
                                    setPasswordErrors((prev) => ({
                                      ...prev,
                                      currentPassword: false,
                                      form: false,
                                    }));
                                  }}
                                />
                                <button
                                  type="button"
                                  className={styles.eyeToggle}
                                  aria-label={`${passwordVisibility.currentPassword ? 'Hide' : 'Show'} current password`}
                                  aria-pressed={passwordVisibility.currentPassword}
                                  onClick={() =>
                                    setPasswordVisibility((prev) => ({
                                      ...prev,
                                      currentPassword: !prev.currentPassword,
                                    }))
                                  }
                                >
                                  <EyeIcon revealed={passwordVisibility.currentPassword} />
                                </button>
                              </div>
                            </label>
                          </div>
                          <div className={styles.settingsRow}>
                            <label className={styles.settingsField} htmlFor="account-new-password">
                              New password
                              <div className={styles.passwordField}>
                                <input
                                  id="account-new-password"
                                  type={passwordVisibility.newPassword ? 'text' : 'password'}
                                  name="newPassword"
                                  autoComplete="new-password"
                                  value={passwordForm.newPassword}
                                  placeholder="Enter new password"
                                  className={`${styles.settingsInput} ${
                                    passwordErrors.newPassword ? styles.inputError : ''
                                  }`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPasswordForm((prev) => ({ ...prev, newPassword: value }));
                                    setPasswordErrors((prev) => ({ ...prev, newPassword: false, form: false }));
                                  }}
                                />
                                <button
                                  type="button"
                                  className={styles.eyeToggle}
                                  aria-label={`${passwordVisibility.newPassword ? 'Hide' : 'Show'} new password`}
                                  aria-pressed={passwordVisibility.newPassword}
                                  onClick={() =>
                                    setPasswordVisibility((prev) => ({
                                      ...prev,
                                      newPassword: !prev.newPassword,
                                    }))
                                  }
                                >
                                  <EyeIcon revealed={passwordVisibility.newPassword} />
                                </button>
                              </div>
                            </label>
                            <label className={styles.settingsField} htmlFor="account-confirm-password">
                              Confirm new password
                              <div className={styles.passwordField}>
                                <input
                                  id="account-confirm-password"
                                  type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                                  name="confirmPassword"
                                  autoComplete="new-password"
                                  value={passwordForm.confirmPassword}
                                  placeholder="Re-enter new password"
                                  className={`${styles.settingsInput} ${
                                    passwordErrors.confirmPassword ? styles.inputError : ''
                                  }`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPasswordForm((prev) => ({ ...prev, confirmPassword: value }));
                                    setPasswordErrors((prev) => ({
                                      ...prev,
                                      confirmPassword: false,
                                      form: false,
                                    }));
                                  }}
                                />
                                <button
                                  type="button"
                                  className={styles.eyeToggle}
                                  aria-label={`${passwordVisibility.confirmPassword ? 'Hide' : 'Show'} confirmation password`}
                                  aria-pressed={passwordVisibility.confirmPassword}
                                  onClick={() =>
                                    setPasswordVisibility((prev) => ({
                                      ...prev,
                                      confirmPassword: !prev.confirmPassword,
                                    }))
                                  }
                                >
                                  <EyeIcon revealed={passwordVisibility.confirmPassword} />
                                </button>
                              </div>
                            </label>
                          </div>
                          <div className={styles.settingsActions}>
                            <button type="submit" className={styles.saveButton} disabled={isUpdatingPassword}>
                              {isUpdatingPassword ? 'Updating...' : 'Save new password'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    <div
                      className={`${styles.settingsCard} ${styles.dangerCard}`}
                      aria-label="Delete account"
                      ref={deleteCardRef}
                    >
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <p className={styles.panelKicker}>Danger zone</p>
                          <div className={styles.cardTitleRow}>
                            <h4 className={styles.cardTitle}>Delete account</h4>
                            <InfoTooltip label="Account deletion details" title="Before deleting" variant="inline">
                              All devices must be unlinked from this account via the sender software (rs.local:3000) before deleting this account.
                            </InfoTooltip>
                          </div>
                          <p className={styles.settingsSummary}>
                            Devices linked: {linkedDeviceCount}
                          </p>
                        </div>
                        <div className={styles.cardHeaderActions}>
                          <button
                            type="button"
                            className={`${styles.secondaryButton} ${styles.collapseLabel}`}
                            disabled={isDeletingAccount || hasLinkedDevices}
                            onClick={() => setShowDeleteConfirm(true)}
                          >
                            {deleteActionLabel === 'Unlink devices first' ? (
                              <span className={styles.iconBadge} aria-hidden="true">
                                <BrokenChainIcon />
                              </span>
                            ) : (
                              <span className={styles.iconBadge} aria-hidden="true">
                                <TrashIcon />
                              </span>
                            )}
                            <span className={styles.buttonLabel}>{deleteActionLabel}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {pageTransition === 2 && (
        <form
          className={styles.addDeviceForm}
          ref={addDeviceFormRef}
          onSubmit={handleAddDeviceSubmit}
        >
          <div className={styles.panelHeader}>
            <h2>Add New Device</h2>
          </div>{' '}
          {/* End of Device List panelHeader */}
          <div className={styles.panelBody}>
            <div className={styles.inputField}>
              <input type="text" name="network" title="(e.g. `AM`)" placeholder="" />
              <label className={styles.inputLabel}>Network: (e.g. `AM`)</label>
            </div>
            <div className={styles.inputField} title="(e.g. `R3B2D`)">
              <input type="text" name="station" placeholder="" />
              <label className={styles.inputLabel}>Station: (e.g. `R3B2D`)</label>
            </div>
            <div className={styles.inputField}>
              <input
                type="text"
                name="elevation"
                title="in meters; relative to sea level (e.g. `1.232314`)"
                placeholder=""
              />
              <label className={styles.inputLabel}>
                Elevation: (in meters; relative to sea level. e.g. `1.232314`)
              </label>
            </div>
            <div className={styles.inputField}>
              <input
                type="text"
                name="latitude"
                title="in degree coordinates (e.g. `10.1234`)"
                placeholder=""
              />
              <label className={styles.inputLabel}>
                Latitude: (in degree coordinates. Range is from -90 to 90. e.g. `10.1234`)
              </label>
            </div>
            <div className={styles.inputField}>
              <input
                type="text"
                name="longitude"
                title="in degree coordinates (e.g. `0.1234`)"
                placeholder=""
              />
              <label className={styles.inputLabel}>
                Longitude: (in degree coordinates. Range is from -180 to 180. e.g. `0.1234`)
              </label>
            </div>
            <div className={styles.buttonDiv}>
              <button type="submit">Submit</button>
              <button type="button" className={styles.cancelButton} onClick={handleCancelClick}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}
      {pageTransition < 2 && showDeleteConfirm && (
        <div
          className={styles.confirmOverlay}
          role="presentation"
        >
          <div
            className={styles.confirmCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteBodyId}
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.confirmTitle} id={deleteTitleId}>
              Delete this account?
            </p>
            <p className={styles.confirmText} id={deleteBodyId}>
              This removes access to linked dashboards and tokens. This action cannot be undone.
            </p>
            <label className={styles.confirmCheckRow}>
              <input
                type="checkbox"
                checked={confirmDeleteChecked}
                onChange={(event) => setConfirmDeleteChecked(event.target.checked)}
              />
              I understand this permanently deletes my contributor account.
            </label>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || hasLinkedDevices || !confirmDeleteChecked}
                ref={deleteConfirmRef}
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

export { Dashboard };
