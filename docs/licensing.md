# Software and content licensing

## Application software

The application source is licensed under the GNU Affero General Public License, version 3 only (AGPL-3.0-only). The complete license is in the repository's [LICENSE](../LICENSE) file. The website footer links to both that license and the source tree for the exact deployed commit.

This change applies prospectively to the project version carrying it. It does not change the terms of earlier versions published under the MIT License; those copies remain available under their original MIT terms.

## Personal and third-party content

The software license does not grant rights to personal hiking articles or translations, photographs, GPS files or tracking data, logos, forest artwork, the Knut vandrar name or other branding, or other personal or third-party content. Those materials remain subject to their existing rights and any applicable third-party terms. The site's copyright line for Knut Holm's content and brand is separate from the software license.

Map styles and data have separate upstream terms. The notices in [OPENFREEMAP-LICENSE.md](../maps/OPENFREEMAP-LICENSE.md) and [LIBERTY-LICENSE.md](../maps/LIBERTY-LICENSE.md) remain in place; the MIT text in the OpenFreeMap notice applies to that upstream material, not to this application.

## Ownership and dependency review

Copyright © 2026 Knut Holm applies to project-authored application software unless a file states otherwise. The human-authored commit history reviewed for this change identifies Knut Holm as the author of the project commits. The bundled map-style notices identify their upstream authors and terms, which are preserved. Git history is evidence of authorship, not a record of any separate employment or contractor agreements.

The npm lockfiles and pinned Python dependency metadata were reviewed for license declarations. The JavaScript dependency graph includes permissive licenses and packages under MPL-2.0 and LGPL-3.0-or-later; the Python dependencies include `psycopg2-binary` under LGPL with exceptions. No incompatible license was identified in the reviewed dependency declarations. Dependencies remain under their own licenses, and their upstream notices are not replaced by this project's AGPL license. Review license metadata again when dependencies change.
