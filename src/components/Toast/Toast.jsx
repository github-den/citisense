'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle, WarningCircle, XCircle, Info } from '@phosphor-icons/react';
import styles from './Toast.module.css';

const TOAST_TYPES = {
  success: { Icon: CheckCircle, className: styles.success },
  error: { Icon: XCircle, className: styles.error },
  warning: { Icon: WarningCircle, className: styles.warning },
  info: { Icon: Info, className: styles.info },
};

let toastCount = 0;
const PENDING_TOASTS_KEY = 'citisense-pending-toasts';
const TOAST_DURATION_MS = 2000;

function canUseSessionStorage() {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

function normalizeToastOptions(message, typeOrOptions = 'info', duration = TOAST_DURATION_MS) {
  const options = typeof typeOrOptions === 'object' && typeOrOptions !== null
    ? typeOrOptions
    : { type: typeOrOptions, duration };

  return {
    message,
    type: options.type ?? 'info',
    duration: TOAST_DURATION_MS,
    navigateTo: options.navigateTo ? String(options.navigateTo) : null,
  };
}

function readPendingToasts() {
  if (!canUseSessionStorage()) return [];

  try {
    const raw = window.sessionStorage.getItem(PENDING_TOASTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingToasts(toasts) {
  if (!canUseSessionStorage()) return;
  if (!toasts.length) {
    window.sessionStorage.removeItem(PENDING_TOASTS_KEY);
    return;
  }

  window.sessionStorage.setItem(PENDING_TOASTS_KEY, JSON.stringify(toasts));
}

export function showToast(message, typeOrOptions = 'info', duration = TOAST_DURATION_MS) {
  const toast = normalizeToastOptions(message, typeOrOptions, duration);
  const id = ++toastCount;
  const event = new CustomEvent('toast', {
    detail: {
      id,
      ...toast,
    },
  });
  window.dispatchEvent(event);
  return id;
}

export function queueToastAfterNavigation(message, typeOrOptions = 'info', duration = TOAST_DURATION_MS) {
  const toast = normalizeToastOptions(message, typeOrOptions, duration);
  const pendingToasts = readPendingToasts();
  writePendingToasts([...pendingToasts, toast]);
}

export default function ToastContainer() {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const pushToast = (toast) => {
      const toastId = toast?.id ?? ++toastCount;
      const nextToast = { ...toast, id: toastId };
      setToasts((prev) => [...prev, nextToast]);

      if (nextToast.duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== toastId));
        }, nextToast.duration);
      }
    };

    const handleToast = (event) => {
      pushToast(event.detail);
    };

    const flushPendingToasts = () => {
      const pendingToasts = readPendingToasts();
      if (!pendingToasts.length) return;

      writePendingToasts([]);
      pendingToasts.forEach((toast) => pushToast(toast));
    };

    window.addEventListener('toast', handleToast);
    window.addEventListener('citisense:flush-pending-toasts', flushPendingToasts);
    flushPendingToasts();

    return () => {
      window.removeEventListener('toast', handleToast);
      window.removeEventListener('citisense:flush-pending-toasts', flushPendingToasts);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('citisense:flush-pending-toasts'));
  }, [pathname]);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  function handleToastClick(toast) {
    if (!toast?.navigateTo) return;
    router.push(toast.navigateTo);
    removeToast(toast.id);
  }

  return (
    <div className={styles.container} role="alert" aria-live="polite">
      {toasts.map((toast) => {
        const { Icon, className } = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
        return (
          <div
            key={toast.id}
            className={[
              styles.toast,
              className,
              toast.navigateTo ? styles.toastInteractive : '',
            ].filter(Boolean).join(' ')}
            onClick={() => handleToastClick(toast)}
            role={toast.navigateTo ? 'button' : undefined}
            tabIndex={toast.navigateTo ? 0 : undefined}
            onKeyDown={(event) => {
              if (!toast.navigateTo) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToastClick(toast);
              }
            }}
          >
            <Icon size={20} weight="fill" className={styles.icon} aria-hidden="true" />
            <span className={styles.message}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
