# EXPLAIN/PROFILE Testing Guide

## Test Setup

**Database:** Neo4j at bolt://192.168.8.119:7687
**Username:** neo4j
**Password:** neo4j123
**Database:** neo4j
**URL:** http://192.168.8.8:3000

---

## Test 1: EXPLAIN Query

### Step 1: Connect to Database
1. Navigate to http://192.168.8.8:3000
2. Enter connection details:
   - Protocol: bolt
   - Host: 192.168.8.119
   - Port: 7687
   - Username: neo4j
   - Password: neo4j123
   - Database: neo4j
3. Click "Initialize Link"
4. Wait for workspace to load

### Step 2: Run EXPLAIN Query
In the query editor, type:
```cypher
EXPLAIN MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 10
```

Click "Run" button.

### Expected Results

**Visual Indicators:**
- ✅ Page title shows "Query Plan" (not "Query Profile")
- ✅ Top dashboard shows metrics with "Est. Rows" label
- ✅ Tree structure displays execution operators
- ✅ Operators are color-coded (blue for scans, green for filters/projections)
- ✅ Performance tips panel appears at bottom

**What to Check:**
1. **Plan Tree:** Should show operators like:
   - ProduceResults (root)
   - Projection
   - Expand (for relationships)
   - NodeByLabelScan or NodeIndexSeek

2. **Dashboard:** Should display:
   - Total Time: 0ns (EXPLAIN doesn't run query)
   - Total Rows: 0 (estimated only)
   - DB Hits: 0
   - Memory Used: 0

3. **Operator Details:** Click on any operator to see:
   - Operator type (e.g., "ProduceResults")
   - Estimated Rows
   - Details string (if available)
   - Pipeline info (if parallel execution)

4. **Expand/Collapse:** Click the chevron (▼/▶) next to operators with children:
   - Should expand/collapse child operators
   - Indentation shows hierarchy depth

**Console Logs Expected:**
```
[executeCypher] Is EXPLAIN/PROFILE: true
[executeCypher] Mode: explain
```

---

## Test 2: PROFILE Query

### Step 1: Run PROFILE Query
Change the query to:
```cypher
PROFILE MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 10
```

Click "Run" button.

### Expected Results

**Visual Indicators:**
- ✅ Page title changes to "Query Profile"
- ✅ Top dashboard shows actual metrics with real values
- ✅ Operators show actual Rows, DB Hits, Time, Memory
- ✅ Page Cache Hit Ratio appears (if available)

**What to Check:**

1. **Plan Tree:** Same structure as EXPLAIN but with actual metrics:
   - Each operator shows:
     - **Rows**: Actual rows produced
     - **DB Hits**: Actual database accesses
     - **Time**: Execution time for this operator
     - **Memory**: Memory allocated

2. **Dashboard Metrics:** Should show non-zero values:
   - **Total Time**: > 0 (e.g., 500µs or 2.5ms)
   - **Total Rows**: Actual number of rows processed
   - **Total DB Hits**: Sum of all operator DB Hits
   - **Memory Used**: Total memory allocated (e.g., 256KB or 1.2MB)

3. **EAGER Operators:** Look for:
   - Orange "EAGER" badge on operators
   - These consume all rows before producing output
   - Common in: Aggregation, Sort, Distinct, Top operators

4. **Color Coding:**
   - 🟦 **Blue**: Scan operators (NodeByLabelScan, AllNodesScan)
   - 🟩 **Green**: Transform operators (Filter, Projection)
   - 🟧 **Orange**: Aggregation operators (EagerAggregation, Sort)
   - 🟪 **Purple**: Modification operators (CreateNode, SetNodeProperty)

**Console Logs Expected:**
```
[executeCypher] Is EXPLAIN/PROFILE: true
[executeCypher] Mode: profile
[executeCypher] Profile metrics: {
  totalTime: 1234567,
  totalDbHits: 42,
  totalMemory: 512,
  totalRows: 10
}
```

---

## Test 3: Switch Between Query Types

### Test Sequence:

**Graph Query:**
```cypher
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 10
```
- Should show GraphCanvas visualization
- Node and relationship count badges appear

**Tabular Query:**
```cypher
MATCH (n) RETURN n.name, n.born LIMIT 10
```
- Should show QueryResultTable
- Table displays results in grid format

**EXPLAIN Query:**
```cypher
EXPLAIN MATCH (n) RETURN n LIMIT 10
```
- Should show ExecutionPlanView
- Tree visualization with estimated metrics

**PROFILE Query:**
```cypher
PROFILE MATCH (n) RETURN n LIMIT 10
```
- Should show ExecutionPlanView
- Tree visualization with actual performance metrics

---

## Performance Comparison Test

Run the same query with both EXPLAIN and PROFILE to compare estimates vs actual:

**EXPLAIN:**
```cypher
EXPLAIN MATCH (n:Person) WHERE n.born > 1980 RETURN n
```

**PROFILE:**
```cypher
PROFILE MATCH (n:Person) WHERE n.born > 1980 RETURN n
```

**What to Compare:**
1. **Estimated Rows** (EXPLAIN) vs **Actual Rows** (PROFILE)
2. **Are estimates accurate?**
   - If estimates are way off, the planner may be confused
   - Consider using query hints or statistics updates

3. **Are there EAGER operators?**
   - EAGER in PROFILE means memory consumption
   - Try to rewrite query to avoid eager operations

---

## Known Issues to Investigate

If you encounter any of these, note them:

**Issue 1: Plan not displaying**
- Check console for errors
- Look for `[executeCypher] Is EXPLAIN/PROFILE: true` log

**Issue 2: Missing operators in tree**
- Verify all operators have children arrays
- Check convertPlan recursive function

**Issue 3: Dashboard shows all zeros in PROFILE**
- Verify `result.summary.profile` has actual metrics
- Check operator.time, operator.dbHits properties

**Issue 4: EAGER badge not appearing**
- Check operatorType string includes "eager" (case-insensitive)
- Verify badge rendering logic in PlanNode component

---

## Test Checklist

**EXPLAIN Queries:**
- [ ] Simple node scan displays
- [ ] Relationship traversal shows Expand operator
- [ ] Estimated rows appear for each operator
- [ ] Tree can expand/collapse
- [ ] Operator colors are correct
- [ ] Performance tips panel is visible

**PROFILE Queries:**
- [ ] All EXPLAIN checks pass
- [ ] Actual rows displayed (not estimated)
- [ ] DB Hits shown for each operator
- [ ] Time displayed for each operator
- [ ] Memory displayed for each operator
- [ ] Dashboard shows non-zero total time
- [ ] Dashboard shows total DB Hits
- [ ] Page cache ratio appears (if available)
- [ ] EAGER operators highlighted

**Switching Between Types:**
- [ ] Graph → Tabular switches correctly
- [ ] Tabular → EXPLAIN switches correctly
- [ ] EXPLAIN → PROFILE switches correctly
- [ ] PROFILE → Graph switches correctly
- [ ] No previous data remains (clean state transitions)

---

## Success Criteria

✅ **EXPLAIN is working if:**
- Query plan tree displays with operator hierarchy
- Estimated metrics appear (rows, no time/db hits)
- Operators are color-coded by type
- Dashboard shows "Estimated" values

✅ **PROFILE is working if:**
- Same tree structure as EXPLAIN
- Actual metrics appear (time, db hits, memory, rows)
- Dashboard totals are calculated correctly
- EAGER operators are highlighted
- Page cache hit ratio displays

✅ **Integration is working if:**
- All query types (graph, table, explain, profile) coexist
- Switching between them clears previous state correctly
- No errors in browser console
- UI is responsive on mobile and desktop

---

## Notes

- All plans show operator type with "@neo4j" suffix (e.g., "ProduceResults@neo4j")
- EAGER operators in PROFILE mode are performance bottlenecks - they force full result collection
- Page Cache Hit Ratio > 90% is good, < 50% needs attention
- Compare EXPLAIN vs PROFILE to find planning inaccuracies
