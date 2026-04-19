# Changelog

All notable changes to `tmai-react` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once tagged releases begin. UI-facing changes that depend on `tmai-api-spec` updates
will note the minimum spec version required.

## [Unreleased]

### Added

- _nothing yet_

### Changed

- _nothing yet_

### Fixed

- Git panel no longer stays stuck on "Loading branches..." when 8+ branches
  are present. `listBranches` now fires first in `fetchData` so it claims an
  HTTP connection slot before slower supplementary requests (`gitGraph`,
  `listPrs`, `listIssues`) that share the pool with concurrent fetches from
  other components. ([#1](https://github.com/trust-delta/tmai-react/issues/1),
  [#7](https://github.com/trust-delta/tmai-react/pull/7))
- Branch-graph `main` lane no longer appears horizontally detached at >=5
  lanes. `layout.svgWidth` now uses symmetric `LEFT_PAD` margins
  (`2 * LEFT_PAD + totalLanes * laneW`) and `LaneGraph` consumes that value
  directly — the prior local `graphW` computation with asymmetric 20px/12px
  margins is removed. ([#6](https://github.com/trust-delta/tmai-react/issues/6),
  [#10](https://github.com/trust-delta/tmai-react/pull/10))

[Unreleased]: https://github.com/trust-delta/tmai-react/compare/main...HEAD
