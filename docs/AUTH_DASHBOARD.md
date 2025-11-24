# Auth & Dashboard

Authentication UI lives in the Header and shows a Dashboard overlay when logged in.

## Components

- `Header`: orchestrates auth and dashboard toggling — `src/components/Header.jsx`
- `Form`: `SignInForm`, `SignUpForm` — `src/components/Form.jsx`
- `Dashboard`: post‑login features — `src/components/Dashboard.jsx`
- `Toast`: transient messages — `src/components/Toast.jsx`

## Behavior

- On mount, `Header` checks `/accounts/profile` with credentials to restore sessions
- Sign in/up modals control `isLoggedIn` and selected user/role state
- Dashboard overlay toggles via header actions

## Styling

- Modules: `src/components/Header.module.css`, `src/components/Dashboard.module.css`, `src/components/Form.module.css`

## Notes

- Axios sends cookies with `withCredentials = true`; ensure CORS and backend are configured
- Avoid storing tokens in localStorage; rely on httpOnly cookies when possible

