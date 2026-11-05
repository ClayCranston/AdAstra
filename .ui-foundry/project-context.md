# AdAstra

Local-first accountability application for a person and their friends. Organizations contain groups; users have personal goals with explicit group-sharing choices. Organization roles are owner, administrator and member. Owners and administrators cannot read private goal details belonging to others.

Primary actions: create a goal, record today's progress, inspect shared group commitments, manage organizations and invites, and read private daily/weekly messages.

Technology: Next.js, TypeScript, SQLite, Auth.js; one Docker container with a persistent volume. No external runtime integrations required. Google OAuth is conditional on explicit credentials. Emails are local previews. Locally bundled fonts support offline rendering.

Constraints: localhost deployment; development profiles clearly labeled; no real emails or external account connections; preserve user-approved privacy defaults. All fixture activity is visibly described as sample data.
