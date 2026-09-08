# Frontend

React product UI, organized by feature. Next.js URL entry points stay in [app/](../app/).

- `features/`: landing, authentication, dashboard, challenges, submissions, reviews,
  profiles, rewards and other product screens.
- `components/layout/`: shared header, role navigation and wallet summary.
- `components/feedback/`: skeletons and loading/error feedback.
- `components/wallet/`: Wallet Standard connection, signatures and payments.
- `i18n/`: Vietnamese/English interface copy and language context.
- `styles/`: the existing stylesheet layers, imported in their original order.

Runtime imports from backend modules are forbidden. Type-only imports are allowed
until shared domain types are extracted. Pure rules live in [shared/](../shared/).

Never place API secrets or server signing keys here. Run npm commands from the
repository root. See [the design system](../docs/design/system.md).
