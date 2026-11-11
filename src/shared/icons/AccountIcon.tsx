export default function AccountIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 12.25c2.347 0 4.25-1.903 4.25-4.25S14.347 3.75 12 3.75 7.75 5.653 7.75 8s1.903 4.25 4.25 4.25Z" />
      <path d="M18.25 20.25v-1a2.25 2.25 0 0 0-2.25-2.25h-8a2.25 2.25 0 0 0-2.25 2.25v1" />
      <circle cx="12" cy="12" r="9.25" />
    </svg>
  );
}