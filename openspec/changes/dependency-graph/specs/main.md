# Scenarios

Scenario: emit a Mermaid graph for ready tasks across features
  Given two changes "dark-mode" and "auth-rate-limit" with populated tasks
  When  the user runs `openspecpm next --graph`
  Then  the output contains a `flowchart` Mermaid block
  And   every parallel-safe ready task appears as a node
  And   edges represent each task's `depends_on` references

Scenario: cap large graphs with --max-nodes
  Given a project with 80 tasks across 5 changes
  When  the user runs `openspecpm next --graph --max-nodes 30`
  Then  the Mermaid block contains at most 30 nodes
  And   the output ends with a footer line reading `(+50 tasks omitted)`

Scenario: critical-path edges render with a distinct style
  Given a dependency chain four tasks deep is the longest in the project
  When  the user runs `openspecpm blocked --graph`
  Then  the edges along that chain use the `linkStyle` for "critical"
  And   nodes on the chain carry the `critical` classDef
