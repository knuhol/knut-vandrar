# Admin UI conventions

- Admin controls are English only. Keep their copy in `src/admin/messages/en.json`.
- MUI is scoped to this admin root and may use MUI component styling APIs. Public shared components retain their existing styling restrictions.
- Use the default MUI dark palette and standard MUI typography with Roboto. Use existing design tokens for other customized theme values. Keep API resource metadata and schema helpers centralized in `src/admin`.
- Saving source content or review status must never request paid translations. Only a separately confirmed request may enqueue work.

- Keep admin buttons content-sized through the scoped MUI theme. Group related actions in horizontal rows that can wrap on narrow screens; do not stretch buttons across the page.

- Define entity field sections centrally in `src/admin/resources.ts` and use `EditorSection` within a single entity-level `EditorSections` provider for collapsible groups. All panels start closed, and only one panel may be open at a time. Keep collapsed content mounted to retain edits, reveal invalid required fields on Save, and include newly added schema fields through the fallback group.

- Mark only sections with changes relative to their saved baseline using the shared warning tint and Unsaved changes badge. Clear the marker on successful save or when changes are reverted. Keep error text readable on the tinted surface and omit separator lines between panels.
