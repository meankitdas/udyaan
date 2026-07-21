export function StepIcon({ name }: { name: string }) {
  switch (name) {
    case "sprout":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 20h10" />
          <path d="M12 20c0-3 .5-5.5 2-8" />
          <path d="M9.8 10.3c1 .8 1.7 2 2.2 3.4-2 .4-3.5.3-4.8-.4-1.2-.6-2.2-1.9-2.9-4 2.7-.4 4.4.2 5.5 1z" />
          <path d="M14 6.5a7 7 0 0 0-1 3.8c1.8-.1 3.2-.6 4.1-1.4 1-.9 1.5-2.2 1.6-4.4-2.6.1-3.9.9-4.7 2z" />
        </svg>
      );
    case "person":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M18.5 20a6.5 6.5 0 0 0-13 0" />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
          <path d="M2 22c0-3 1.9-5.4 5.1-6" />
        </svg>
      );
    case "tractor":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 13V5h5l1.5 4.5" />
          <path d="M10.5 11H20a1 1 0 0 1 1 1.1l-.5 3.4a1 1 0 0 1-1 .9" />
          <path d="M17 11V6" />
          <path d="M11 16.5h4.5" />
          <circle cx="8" cy="15" r="4" />
          <circle cx="18" cy="17.5" r="1.8" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      );
    case "spiral":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M8.5 14a5.5 5.5 0 1 1 7 0c-.7.6-1.1 1.2-1.3 2h-4.4c-.2-.8-.6-1.4-1.3-2z" />
        </svg>
      );
    case "confetti":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8.5 4.5H15A1.5 1.5 0 0 1 16.5 6v13A1.5 1.5 0 0 1 15 20.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5h.5" />
          <path d="M9 3.5A1.5 1.5 0 0 1 10.5 2h1A1.5 1.5 0 0 1 13 3.5v1H9z" />
          <path d="M8 12.5l2 2 3.5-3.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V5M7.5 9L12 4.5 16.5 9" />
      <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}
