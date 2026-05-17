# Scenarios

Scenario: judge detects a vague observable outcome the regex linter missed
  Given a spec contains the Then clause "Then the request returns successfully"
  And   the heuristic linter passes that clause (`returns` is on the verb list)
  When  the user runs `openspecpm validate --llm`
  Then  the output includes a finding with rule id `bdd/vague-then`
  And   the finding cites the spec file and line of the offending Then

Scenario: judge surfaces a cross-spec contradiction
  Given spec A asserts "Then the user is signed out"
  And   spec B asserts "Then the user remains signed in" for the same trigger
  When  the user runs `openspecpm validate --llm`
  Then  both findings carry rule id `bdd/contradiction`
  And   each finding names the conflicting spec file as evidence

Scenario: prompt cache hit keeps repeat runs cheap
  Given the proposal context for a change has already been judged once this session
  When  the user re-runs `openspecpm validate --llm` against the same change
  Then  the SDK call reports `cache_read_input_tokens` greater than zero
  And   the wall-clock duration of the second run is at most half the first
