# Local accountability brief

The existing repository had only a README: no functional UI, dependencies, screenshots, bundle or performance baseline existed. The user authorized building a local prototype and Google-auth-ready frontend, while deferring external account connections.

The interface centers a daily ritual: choose a commitment, record honest progress, see an explainable score, and check in with a small group. Existing user instructions provide feature priorities and privacy rules; no personal taste profile was supplied or inferred.

## Direction comparison

All directions use the same goals, role hierarchy, daily check-ins and privacy boundary.

1. Native ritual desk: static editorial hierarchy, weekly selector, task rows and a small SVG score ring. Low dependency cost; direct path to the primary action.
2. State-driven focus deck: one commitment at a time with animated card transitions. More interaction work and less useful overview for daily planning.
3. Specialist constellation: spatial goal clusters. Additional renderer and accessibility overhead without improving accountability task completion.

Selected direction: native ritual desk. This is an implementation judgment within the authorized frontend task, not a claimed user preference or independent design approval. Dark evergreen navigation, warm paper workspace, rust actions and locally bundled serif/sans fonts make the information hierarchy clear. Movement is limited to CSS state transitions and respects reduced motion.

Implementation class: native. Dependencies: existing React/Next runtime, Lucide icons, bundled Fontsource fonts. No animation, charting or rendering frameworks.

Acceptance scenarios are in the adjacent JSON. The implementation remains removable as normal uncommitted source changes; no global software settings or remote resources are changed.
