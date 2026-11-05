# RestoreCart Bryntum setup

The original installation note was found in the earlier ScrapDrop codebase at BRYNTUM_SETUP.md. RestoreCart uses the same pinned public npm trial alias, not the downloaded Gantt ZIP:

```sh
npm install --save-exact --ignore-scripts --registry=https://registry.npmjs.org @bryntum/schedulerpro@npm:@bryntum/schedulerpro-trial@7.3.7 @bryntum/schedulerpro-react@7.3.7
```

The lockfile records registry URLs/integrity hashes. No registry account or extra API key is required for this public trial installation. Keep installation lifecycle scripts disabled, as configured in .npmrc; do not automatically rebuild vendor packages or commit their contents.

RestoreCart uses Scheduler Pro with the React wrapper for pickup scheduling and a plain appointment-list fallback. Actual eligible appointments can be dragged to propose a move; an explicit confirmation saves it after server checks for overlap, eligibility, opening windows and stale edits. Sample appointments remain read-only. Keyboard-accessible forms can also reschedule and find the next available slot. Orders and stock are maintained by RestoreCart, not by the timeline. Sample appointments are UI examples; actual appointments must be saved against eligible paid orders.

Local development enables the evaluation timeline unless VITE_ENABLE_BRYNTUM=false. Hosted builds require VITE_ENABLE_BRYNTUM=true at build time; changing it requires rebuilding. The default Blueprint leaves it disabled. An existing Render environment variable can override that default.

The original setup note says evaluation/deployment coverage still requires confirmation. It contains no personal trial start date, expiry date or special hackathon entitlement. We therefore cannot establish that from the setup file. This is a commercial evaluation dependency, not covered by RestoreCart's MIT license. The supported appointment-list fallback is retained.

References:
- https://bryntum.com/products/schedulerpro/docs/guide/SchedulerPro/quick-start/react
- https://bryntum.com/products/license/

## Proposed appointments

The Operations Agent can propose unsaved appointments after server availability checks. Blue events named **Proposed** open a review; **Confirm appointment** performs the existing guarded save. Proposed events cannot be dragged. Actual appointment moves still require confirmation, and a plain list remains usable without the trial timeline. See [the implementation report](AGENT_IMPLEMENTATION_REPORT.md) for controlled and actual-model evidence.
