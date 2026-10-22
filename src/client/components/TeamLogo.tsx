import { useEffect, useState } from 'react';
import { getLogoProxyUrl } from '../../shared/logoUrl';

type TeamLogoProps = {
  flairSlug: string;
  name: string;
  size?: 'sm' | 'md';
};

const teamInitials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

type TeamLogoInitialsProps = {
  name: string;
  dims: string;
};

const TeamLogoInitials = ({ name, dims }: TeamLogoInitialsProps) => {
  const initials = teamInitials(name);
  return (
    <span
      className={`${dims} inline-flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300`}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
};

type TeamLogoImageProps = {
  flairSlug: string;
  name: string;
  dims: string;
};

/**
 * Devvit webviews block bare <img src="/api/..."> — requests miss session auth.
 * fetch() from the app bundle includes credentials; blob URLs work in <img>.
 */
const TeamLogoImage = ({ flairSlug, name, dims }: TeamLogoImageProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const res = await fetch(getLogoProxyUrl(flairSlug));
        if (!res.ok) {
          throw new Error(`logo ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [flairSlug]);

  if (failed || !src) {
    return <TeamLogoInitials name={name} dims={dims} />;
  }

  return (
    <img
      src={src}
      alt={name}
      className={`${dims} object-contain`}
      loading="lazy"
      decoding="async"
    />
  );
};

export const TeamLogo = ({ flairSlug, name, size = 'md' }: TeamLogoProps) => {
  const dims = size === 'sm' ? 'w-8 h-5' : 'w-12 h-8';

  if (!flairSlug) {
    return <TeamLogoInitials name={name} dims={dims} />;
  }

  return (
    <TeamLogoImage key={flairSlug} flairSlug={flairSlug} name={name} dims={dims} />
  );
};
