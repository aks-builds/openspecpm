# Scenarios

Scenario: scaffold Playwright stubs from a multi-scenario spec
  Given the spec file specs/main.md contains three Scenario blocks
  When  the user runs `openspecpm scaffold-tests dark-mode --target playwright`
  Then  one test file appears under tests/dark-mode/main.spec.ts
  And   the file contains exactly three `test(...)` calls
  And   each `test(...)` carries a comment pointing to its source spec line

Scenario: re-running scaffold preserves customized test bodies
  Given a previous scaffold-tests run created tests/dark-mode/main.spec.ts
  And   an engineer has filled in the body of the first `test(...)`
  When  the engineer adds a new Scenario block to the spec
  And   re-runs `openspecpm scaffold-tests dark-mode --target playwright`
  Then  the customized first test body is preserved verbatim
  And   exactly one new `test(...)` stub is appended for the new scenario

Scenario: target framework choice surfaces a clear error when unsupported
  Given the user supplies `--target rspec`
  When  the user runs `openspecpm scaffold-tests dark-mode --target rspec`
  Then  the command exits non-zero
  And   stderr names the supported targets `playwright`, `cucumber`, `jest`
