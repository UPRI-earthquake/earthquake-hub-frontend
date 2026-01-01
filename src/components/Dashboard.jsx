import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { backendHost } from '../utils/env';
import { devlog, deverror } from '../utils/devlog';
import styles from './Dashboard.module.css';
import formStyles from './Form.module.css';
import Toast from './Toast';
import { responseCodes } from '../utils/responseCodes';
import jwtDecode from 'jwt-decode';
import moment from '../utils/time';
import InfoTooltip from './InfoTooltip';

const statusTooltips = {
  'Not Yet Linked': 'Access your raspberry shake device to link it to your e-hub account.',
  'Not Streaming':
    'This device has been linked to your account but is currently not sending data to the server.',
  Streaming: 'This device is sending data to the server.',
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
    nextSteps: [
      {
        title: 'Verify the link',
        copy: 'Use rs.local:3000 to confirm the device is linked to this account.',
      },
      {
        title: 'Keep it online',
        copy: 'Stable power and internet keep your stream healthy. Check cabling and router uptime.',
      },
      {
        title: 'Plan for growth',
        copy: 'Future tools will surface alerts and basic reports here as they roll out.',
      },
    ],
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
        'Generate a barangay access token below and add it to your ringserver configuration.',
        'Ensure each station is powered and forwarding to the UPRI endpoint.',
        'Return here to see status once devices begin streaming.',
      ],
    },
    nextSteps: [
      {
        title: 'Rotate access tokens',
        copy: 'Request fresh tokens before expiry and update your ringserver configuration.',
      },
      {
        title: 'Watch streaming health',
        copy: 'Investigate “Not streaming” rows quickly to keep coverage active.',
      },
      {
        title: 'Prepare for reports',
        copy: 'This workspace will house barangay reports and monitoring summaries.',
      },
    ],
  },
};

const getStatusVariant = (status) => {
  const value = String(status || '').toLowerCase();
  // Check negative states first to avoid "not streaming" matching the streaming branch
  if (value.includes('not streaming') || value === 'inactive') return 'warn';
  if (value.includes('streaming') || value === 'active') return 'ok';
  return 'muted';
};

const formatStatusSince = (value) => {
  if (!value) return '—';
  const m = moment(value);
  if (!m.isValid()) return value;
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
  const [brgyAccessToken, setBrgyAccessToken] = useState(); // hook for brgyAccessToken
  const [accessTokenExpiry, setAccessTokenExpiry] = useState(); // hook for brgy accessToken expiration
  const [activeSection, setActiveSection] = useState('devices'); // workspace tabs
  const [accountForm, setAccountForm] = useState({
    email: accountEmail || '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: '',
  });
  const [accountErrors, setAccountErrors] = useState({});
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const addDeviceFormRef = useRef(null);
  const dashboardContainerRef = useRef(null);
  const profileRef = useRef(null);
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true); // guard async state updates after unmount
  const timeoutsRef = useRef([]); // track pending timers for cleanup

  // Utility: schedule clearing the toast with automatic cleanup
  const scheduleToastClear = useCallback((ms) => {
    const id = setTimeout(() => {
      if (!isMountedRef.current) return;
      setToastMessage('');
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

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
        description: isBrgy
          ? 'Check barangay-operated stations and their streaming status.'
          : 'View personal devices linked to your contributor account.',
      },
      {
        id: 'tools',
        label: isBrgy ? 'Tools & tokens' : 'Tools',
        description: isBrgy
          ? 'Access tokens and space reserved for upcoming contributor utilities.'
          : 'Contributor tools coming soon.',
        badge: isBrgy ? null : 'beta',
      },
      {
        id: 'account',
        label: 'Account settings',
        description: 'Update your contact email and password.',
        badge: passwordStatus === 'legacy' ? 'update' : null,
      },
    ],
    [isBrgy, passwordStatus],
  );

  const activeSectionMeta = sections.find((section) => section.id === activeSection);

  const statusCounts = useMemo(() => {
    const summary = { streaming: 0, notStreaming: 0, notLinked: 0 };
    (devices || []).forEach((device) => {
      const value = String(device.status || '').toLowerCase();
      if (value.includes('streaming') || value === 'active') summary.streaming += 1;
      else if (value.includes('not streaming') || value === 'inactive') summary.notStreaming += 1;
      else summary.notLinked += 1;
    });
    return summary;
  }, [devices]);

  const hasDevices = (devices || []).length > 0;
  const emptyState = roleConfig.empty;

  useEffect(() => {
    setAccountForm((prev) => ({ ...prev, email: accountEmail || '' }));
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
      } else {
        // For 401/403 or other handled statuses, clear list silently
        setDevices([]);
      }
    } catch (error) {
      // Suppress expected auth errors to keep console clean; UI remains the same
      const status = error?.response?.status;
      if (status === 401 || status === 403) return; // keep devices as []
      // Log unexpected errors for debugging
      if (isMountedRef.current) deverror('Error fetching devices:', error);
    }
  };

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
        setAccessTokenExpiry(remainingTime.days()); // set brgyAccessTokenExpiry value
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

  const validateAccountForm = () => {
    const nextErrors = {};
    const trimmedEmail = (accountForm.email || '').trim();
    const emailChanged = Boolean(trimmedEmail) && trimmedEmail !== (accountEmail || '');
    const passwordChanged = Boolean(accountForm.newPassword);

    if (!emailChanged && !passwordChanged) {
      nextErrors.form = 'Update email or password to save.';
    }

    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (passwordChanged) {
      const passwordIssue = describeAccountPasswordIssue(accountForm.newPassword);
      if (passwordIssue) nextErrors.newPassword = passwordIssue;
      if (accountForm.confirmPassword !== accountForm.newPassword) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if ((emailChanged || passwordChanged) && !accountForm.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    setAccountErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      scheduleToastClear(6000);
      return null;
    }

    const payload = { currentPassword: accountForm.currentPassword };
    if (emailChanged) payload.email = trimmedEmail;
    if (passwordChanged) {
      payload.newPassword = accountForm.newPassword;
      payload.confirmPassword = accountForm.confirmPassword;
    }
    return payload;
  };

  async function handleAccountSubmit(event) {
    event.preventDefault();
    const payload = validateAccountForm();
    if (!payload) return;
    setIsUpdatingAccount(true);
    try {
      axios.defaults.withCredentials = true;
      const backend_host = backendHost();
      await axios.patch(`${backend_host}/accounts/profile`, payload);
      if (!isMountedRef.current) return;
      setToastMessage('Account updated.');
      setToastType('success');
      setAccountErrors({});
      setAccountForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        email: payload.email ?? prev.email,
      }));
      scheduleToastClear(6000);
      if (typeof onProfileRefresh === 'function') onProfileRefresh();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        if (isMountedRef.current) {
          setToastMessage(data?.message || 'Unable to update account.');
          setToastType('error');
          const m = String(data?.message || '').toLowerCase();
          const next = {};
          if (m.includes('email')) next.email = true;
          if (m.includes('current password')) next.currentPassword = true;
          if (m.includes('password')) next.newPassword = true;
          setAccountErrors(next);
          scheduleToastClear(6000);
        }
      } else {
        if (isMountedRef.current) {
          setToastMessage('Unable to update account right now.');
          setToastType('error');
          scheduleToastClear(6000);
        }
      }
      deverror('Error updating account profile:', error?.response || error);
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingAccount(false);
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
              <p className={styles.subtitle}>{roleConfig.subtitle}</p>
            </div>
            <div className={styles.actionStack} role="toolbar" aria-label="Dashboard actions">
              <div className={styles.signedInMeta}>
                Signed in as <span className={styles.boldText}>{loggedInUser || 'Contributor'}</span>
              </div>
              <div className={styles.topBarTools}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={handleSignout}
                  title="Sign out of your account"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => handleClose('close')}
                  aria-label="Close dashboard"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {passwordStatus === 'legacy' && (
            <div className={styles.passwordNotice} role="status" aria-live="polite">
              <div>
                <p className={styles.noticeTitle}>Password update recommended</p>
                <p className={styles.noticeText}>
                  This account uses an older password. Update it in Account settings when convenient.
                </p>
              </div>
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.noticeAction}`}
                onClick={() => setActiveSection('account')}
              >
                Open settings
              </button>
            </div>
          )}

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
                <span className={styles.sectionTabLabel}>{section.label}</span>
                {section.badge && <span className={styles.sectionTabBadge}>{section.badge}</span>}
              </button>
            ))}
          </div>
          {activeSectionMeta?.description && (
            <p className={styles.sectionDescription}>{activeSectionMeta.description}</p>
          )}

          {activeSection === 'devices' && (
            <div className={styles.sectionGrid}>
              <section className={styles.panelBody} aria-label="Device overview">
                <div className={styles.panelHeaderRow}>
                  <div>
                    <p className={styles.panelKicker}>Connectivity</p>
                    <h3 className={styles.panelTitle}>Device overview</h3>
                    <p className={styles.panelSubtitle}>{roleConfig.devicesIntro}</p>
                  </div>
                  <div className={styles.summaryPills} aria-label="Device status summary">
                    <span className={`${styles.summaryPill} ${styles.summaryPillPositive}`}>
                      Streaming <strong>{statusCounts.streaming}</strong>
                    </span>
                    <span className={`${styles.summaryPill} ${styles.summaryPillWarning}`}>
                      Not streaming <strong>{statusCounts.notStreaming}</strong>
                    </span>
                    <span className={styles.summaryPill}>
                      Not yet linked <strong>{statusCounts.notLinked}</strong>
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
                      {hasDevices ? (
                        devices.map((device, index) => {
                          const statusLabel = device.status || 'Not Yet Linked';
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
                                <div className={styles.cellHeading}>{device.station || '—'}</div>
                                {device.description && (
                                  <div className={styles.cellMeta}>{device.description}</div>
                                )}
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
                              <p className={styles.emptyTitle}>{emptyState.title}</p>
                              <p className={styles.emptyBody}>{emptyState.body}</p>
                              <ul className={styles.emptyList}>
                                {emptyState.steps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${styles.panelBody} ${styles.hintPanel}`} aria-label="Contributor guidance">
                <div className={styles.panelHeaderRow}>
                  <div>
                    <p className={styles.panelKicker}>Next steps</p>
                    <h3 className={styles.panelTitle}>Keep your station active</h3>
                  </div>
                </div>
                <ul className={styles.hintList}>
                  {roleConfig.nextSteps.map((hint) => (
                    <li key={hint.title}>
                      <p className={styles.hintTitle}>{hint.title}</p>
                      <p className={styles.hintText}>{hint.copy}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {activeSection === 'tools' && (
            <div className={styles.sectionGrid}>
              {isBrgy ? (
                <>
                  <section className={styles.panelBody} aria-label="Access tokens">
                    <div className={styles.panelHeaderRow}>
                      <div>
                        <p className={styles.panelKicker}>Access control</p>
                        <h3 className={styles.panelTitle}>Tokens & credentials</h3>
                        <p className={styles.panelSubtitle}>
                          Generate a token for barangay ringservers to access the UPRI network.
                        </p>
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
                              Valid for {accessTokenExpiry ?? '—'} days
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
                          <p className={styles.emptyTitle}>No token generated yet</p>
                          <p className={styles.emptyBody}>
                            Use “Request token” to generate credentials for your barangay devices. The
                            token will appear here once created.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className={`${styles.panelBody} ${styles.futurePanel}`} aria-label="Upcoming tools">
                    <div className={styles.panelHeaderRow}>
                      <div>
                        <p className={styles.panelKicker}>Coming soon</p>
                        <h3 className={styles.panelTitle}>Workspace add-ons</h3>
                        <p className={styles.panelSubtitle}>
                          This dashboard is built to host monitoring, reports, and new contributor
                          tools as they launch.
                        </p>
                      </div>
                    </div>
                    <ul className={styles.hintList}>
                      <li>
                        <p className={styles.hintTitle}>Multi-device health</p>
                        <p className={styles.hintText}>Rollup views for uptime and streaming quality.</p>
                      </li>
                      <li>
                        <p className={styles.hintTitle}>Reports & exports</p>
                        <p className={styles.hintText}>
                          Reserved space for barangay reports and download tools.
                        </p>
                      </li>
                      <li>
                        <p className={styles.hintTitle}>Role-specific alerts</p>
                        <p className={styles.hintText}>
                          Notifications tuned to how you participate in the network.
                        </p>
                      </li>
                    </ul>
                  </section>
                </>
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
                    <h3 className={styles.panelTitle}>Account settings</h3>
                    <p className={styles.panelSubtitle}>
                      Manage your contact email and update your password when needed.
                    </p>
                  </div>
                  <div className={styles.accountBadges}>
                    <span
                      className={`${styles.statusPill} ${
                        passwordStatus === 'legacy' ? styles.statusPillWarn : styles.statusPillOk
                      }`}
                      title={`Password policy version ${passwordPolicyVersion || 'legacy'}`}
                    >
                      Password: {passwordStatus === 'legacy' ? 'Legacy' : 'Secure'}
                    </span>
                  </div>
                </div>

                <div className={styles.accountSummary}>
                  <div className={styles.metaItem}>
                    <p className={styles.metaLabel}>Username</p>
                    <p className={styles.metaValue}>{loggedInUser || '—'}</p>
                  </div>
                  <div className={styles.metaItem}>
                    <p className={styles.metaLabel}>Role</p>
                    <p className={styles.metaValue}>
                      {isBrgy ? 'Barangay operator' : 'Citizen scientist'}
                    </p>
                  </div>
                  <div className={styles.metaItem}>
                    <p className={styles.metaLabel}>Contact email</p>
                    <p className={styles.metaValue}>{accountEmail || 'Not set'}</p>
                  </div>
                </div>

                <form className={styles.accountSettingsForm} onSubmit={handleAccountSubmit} noValidate>
                  <div className={styles.settingsRow}>
                    <label className={styles.settingsField} htmlFor="account-email">
                      <span className={formStyles.fieldLabelRow}>
                        Contact email
                        <InfoTooltip
                          label="Why we need your email"
                          title="Contact email"
                          variant="inline"
                        >
                          Used for account notices, password resets, and security updates.
                        </InfoTooltip>
                      </span>
                      <input
                        id="account-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={accountForm.email}
                        placeholder="you@example.com"
                        className={`${styles.settingsInput} ${accountErrors.email ? styles.inputError : ''}`}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAccountForm((prev) => ({ ...prev, email: value }));
                          setAccountErrors((prev) => ({ ...prev, email: false, form: false }));
                        }}
                      />
                    </label>
                  </div>

                  <div className={styles.settingsRow}>
                    <label className={styles.settingsField} htmlFor="account-new-password">
                      <span className={formStyles.fieldLabelRow}>
                        New password
                        <InfoTooltip
                          label="Password requirements"
                          title="Password requirements"
                          variant="inline"
                        >
                          Minimum 12 characters. Letters, numbers, and special characters.
                        </InfoTooltip>
                      </span>
                      <input
                        id="account-new-password"
                        type="password"
                        name="newPassword"
                        autoComplete="new-password"
                        value={accountForm.newPassword}
                        placeholder="Enter new password"
                        className={`${styles.settingsInput} ${
                          accountErrors.newPassword ? styles.inputError : ''
                        }`}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAccountForm((prev) => ({ ...prev, newPassword: value }));
                          setAccountErrors((prev) => ({ ...prev, newPassword: false, form: false }));
                        }}
                      />
                    </label>
                    <label className={styles.settingsField} htmlFor="account-confirm-password">
                      Confirm new password
                      <input
                        id="account-confirm-password"
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        value={accountForm.confirmPassword}
                        placeholder="Confirm new password"
                        className={`${styles.settingsInput} ${
                          accountErrors.confirmPassword ? styles.inputError : ''
                        }`}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAccountForm((prev) => ({ ...prev, confirmPassword: value }));
                          setAccountErrors((prev) => ({
                            ...prev,
                            confirmPassword: false,
                            form: false,
                          }));
                        }}
                      />
                    </label>
                  </div>

                  <div className={styles.settingsRow}>
                    <label className={styles.settingsField} htmlFor="account-current-password">
                      Current password
                      <input
                        id="account-current-password"
                        type="password"
                        name="currentPassword"
                        autoComplete="current-password"
                        value={accountForm.currentPassword}
                        placeholder="Enter current password"
                        className={`${styles.settingsInput} ${
                          accountErrors.currentPassword ? styles.inputError : ''
                        }`}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAccountForm((prev) => ({ ...prev, currentPassword: value }));
                          setAccountErrors((prev) => ({
                            ...prev,
                            currentPassword: false,
                            form: false,
                          }));
                        }}
                      />
                    </label>
                  </div>

                  <div className={styles.settingsActions}>
                    <button type="submit" className={styles.saveButton} disabled={isUpdatingAccount}>
                      {isUpdatingAccount ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
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
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

export { Dashboard };
