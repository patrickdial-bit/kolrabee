# Branch cleanup — 34 branches to delete

_Prepared 2026-08-24. **Not yet executed** — the automation running this pass
could push commits but got HTTP 403 on `delete_ref`, so branch deletion needs a
person with delete rights on the repo._

Every branch below was checked with `git cherry origin/main origin/<branch>`.
29 are fully contained in `main`; the rest are noted in the table.

Branches deliberately kept: `main`, `claude/painter1-admin-unlimited-v006wi`
(PR #60), `claude/brave-cori-MyzGc` (Ads Agent, PR closed but code kept),
`feature/bid-board-v1`, and the review branch.

## To run

```bash
git fetch origin --prune
git push origin --delete $(sed -n '/^| `/s/^| `\([^`]*\)`.*/\1/p' docs/BRANCH_CLEANUP.md | tr '\n' ' ')
```

Or one at a time, from the list below:
`git push origin --delete <branch>`

Deleting these on github.com (Branches → the trash icon) works too.

## Recovery

`git checkout -b <name> <sha>`. The SHAs are recorded because deleting a remote
branch drops the only ref to any commit that was never merged — merged work is
safe in `main`'s history regardless.

| Branch | Head SHA | Unique commits | Why it went |
|---|---|---|---|
| `claude/add-admin-management-5q3qS` | `885b331205605d2ef8ddf4b8391c64cc7ca48f32` | 0 | Fully contained in main |
| `claude/add-crew-roles-kvmEY` | `09bac56ab540c5a722759539d8efa5ba6f164af2` | 0 | Fully contained in main |
| `claude/add-subcontractor-document-upload-dccKY` | `6b46c73f03c3802636883efcb378c982baeb2a85` | 0 | Fully contained in main |
| `claude/admin-upload-sub-docs` | `2957561ecaec329867445027ad72033d5d0c546d` | 0 | Fully contained in main |
| `claude/archive-kolrabee-project-wbJNf` | `90747ab3d2bb69518c671a3c0301914f1ab4c3fa` | 0 | Fully contained in main |
| `claude/companycam-import` | `dcadeaf826eadb9a3716437609cbb8caea681b6c` | 0 | Fully contained in main |
| `claude/companycam-import-resilience` | `1c7cee7404e98b838854e95a73ffa70ab58bfe8e` | 0 | Fully contained in main |
| `claude/companycam-tag-import` | `9fe5229a525756b427bbeddf57d80a29565f36d7` | 0 | Fully contained in main |
| `claude/compassionate-sagan-ubjFH` | `a1e17320e6a949ab5147169d1cee4e655574c29a` | 0 | Fully contained in main |
| `claude/confident-clarke-TKNbD` | `f15207c8d4e743b663a273bc0ea291e689423735` | 0 | Fully contained in main |
| `claude/dashboard-invites-totals-sAzfA` | `324ccdfcc85bf7fa082accc2845cca1e2dbe334a` | 0 | Fully contained in main |
| `claude/dedupe-dashboard-stats-sAzfA` | `4d2ec474e268d853717053ec9e0ffdee2c8e5b7c` | 0 | Fully contained in main |
| `claude/delete-test-users-sULqD` | `4bb35d231e84ac77aaed8f670528dd96f7c71b48` | 0 | Fully contained in main |
| `claude/fix-cancel-delete-project` | `50b1e959eb08e772989852b4ee99908bf21c7cfa` | 0 | Fully contained in main |
| `claude/fix-dashboard-imported-status` | `8c6a8d89ee1a8734d39cdce4a82144ce0f9a508b` | 0 | Fully contained in main |
| `claude/fix-time-tracking-toggle-Tg9fu` | `e099073d38b9d0c6f95d6b68a28326f38821e6c4` | 0 | Fully contained in main |
| `claude/fix-time-tracking-toggle-whL8g` | `693e208549da68f86001c3fdfbcd2ceaa9af41fe` | 0 | Fully contained in main |
| `claude/idempotent-00018-cascade-fks` | `19cee4627aad6dbc0a99f4e46fcc0e97cdf586b4` | 0 | Fully contained in main |
| `claude/idempotent-migrations` | `9b86d55387767a2ee2a12af592f72c28aa1fec83` | 0 | Fully contained in main |
| `claude/improve-schedule-date-picker-We0LL` | `8818b8b6cc588d7990d0533fe95bfdfa6b9e0a20` | 0 | Fully contained in main |
| `claude/inspiring-wright-dHOi3` | `dbaed29faee1b6bd67590d2e24b725d54b8fef15` | 2 | Superseded — same work shipped differently |
| `claude/new-project-repo-setup-kOtos` | `fca594cc17785a07bf61d472a8e9954164cb508b` | 97 | Orphan history, no merge base with main |
| `claude/peaceful-gauss-2YOXu` | `5bb2d89dd2c130f1c98da6cb51a676cba0ad169f` | 6 | Superseded — same work shipped differently |
| `claude/photo-download-share` | `152e42c586578a5fc7fa52c39d7d057ae1e5b6b4` | 0 | Fully contained in main |
| `claude/photo-impersonation-fix` | `4ff932befadb4169ed45ba14f5520b24c389ae25` | 0 | Fully contained in main |
| `claude/projects-page-pm-crm` | `7169e29bb5472937daa9d6b93598d5d34099e3c2` | 0 | Fully contained in main |
| `claude/review-site-features-0HIkV` | `e68f79f652060a2768a699c1d5d940a4949a5438` | 81 | Orphan history, no merge base with main |
| `claude/review-tasks-Ua1pW` | `956e71ef72db0ab9ee204991b56c659e0bbd045c` | 0 | Fully contained in main |
| `claude/serene-cerf-ikxk8` | `fec377f9b71aef9acf19fc904f46797927d82078` | 0 | Fully contained in main |
| `claude/subcontractor-file-upload-sAzfA` | `48f6efb504d5872862d0cc21e185a46b02d42d91` | 0 | Fully contained in main |
| `claude/subcontractor-message-notifications-ami7m6` | `c5e88cabf758e967656b6bc94ea1e6d30c04c82d` | 0 | Fully contained in main |
| `claude/time-tracking` | `06ccce52b3c3592ee6859e432ff4d5820f1376ca` | 0 | Fully contained in main |
| `feature/bid-board` | `598e1c2b106093ce70ede3e05c1365ff430011ae` | 0 | Fully contained in main |
| `wip/time-tracking-rework` | `4fe8eb05561073f42cf965a1f810bb83d701b108` | 2 | Superseded — same work shipped differently |
