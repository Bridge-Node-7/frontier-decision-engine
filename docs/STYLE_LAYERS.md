# Stylesheet Ownership

Frontier Decision Engine intentionally retains three ordered stylesheets.

1. `site/assets/styles.css`
   - Functional application layout, forms, tables, workflow components, and
     application-specific states.
2. `site/assets/bridge-node-7-shell.css`
   - Bridge Node 7 identity, shared design tokens, shell presentation, navigation,
     footer, responsive disclosure menu, and interactive-boundary contract.
3. `site/assets/beginner-first.css`
   - Start Here experience, beginner-oriented presentation, and the explicit
     solid primary-action background required by computed-style validation.

The load order is part of the public contract and is validated. A broad visual
consolidation is outside v0.2.12. Application-specific status colors and functional
layouts must not be replaced by marketing-site rules.
