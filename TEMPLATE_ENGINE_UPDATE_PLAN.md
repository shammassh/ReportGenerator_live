# Template Engine Update Plan

## Critical Updates Required

### 1. Import Dependencies
- Add utilities module imports (cleanText, extractQuestionId, etc.)
- Add missing service references

### 2. buildDetailsTable Method (COMPLETE REWRITE from lines 1450-1520)
**Current:** Placeholder with basic loop
**Required:**
- Extract question ID from ImageID format
- Filter "before" images (Iscorrective = false)
- Use field mapping helpers (getCriteria, getComment, getCoefficientDisplay, etc.)
- Generate 2-column image grid
- Handle NA coefficients (show blank)
- Show "No Answer" for empty SelectedChoice
- Use ReferenceValue for row numbering

### 3. buildCorrectiveActions Method (NEW from lines 1060-1180)
**Current:** Not implemented
**Required:**
- Filter items where Coeff !== Value && SelectedChoice !== 'NA'
- Show "NO CORRECTIVE ACTIONS REQUIRED" message when none
- Display columns: #, Criteria, Finding, Severity, Corrective Picture, Corrective Action
- Filter "after" images (Iscorrective = true)
- Auto-calculate severity if Priority empty
- Clean text with cleanText helper
- 2-column image grid for corrective photos

### 4. generateFridgesTables Method (NEW from lines 1177-1400)
**Current:** Not implemented
**Required:**
- Fetch SRA Fridges to get ReferenceValue from ResponseJSON
- Fetch "Fridges finding" list with temperature records
- Fetch "Fridges Good" list with compliant records
- Download and convert fridge images to base64
- Generate TWO tables:
  - "FRIDGES WITH FINDINGS" (red header): #, Unit, Display, Probe, Issue, Pictures
  - "COMPLIANT FRIDGES" (green header): #, Unit, Display, Probe, Pictures
- All records use same ReferenceValue from SRA Fridges (typically "2.26")
- Use generateFridgePictureCell from image service

### 5. buildDataTable Method (ENHANCE with historical scores)
**Current:** Shows placeholders "-" for C1-C4
**Required:**
- Call dataService.getHistoricalScoreForStore(storeName, sectionTitle, cycle, sectionMappings)
- Call dataService.getHistoricalOverallScore(cycle) for overall row
- Display actual historical scores instead of "-"
- Handle "0.1" default gracefully

## Implementation Strategy

Since template-engine.js is large (300+ lines), I will:
1. Update buildDetailsTable with complete logic
2. Add new buildCorrectiveActions method
3. Add new generateFridgesTables method  
4. Update buildDataTable to fetch historical scores
5. Update buildDocument to call corrective actions and fridges tables

## Testing Checkpoints
✅ Pictures appear in detailed section tables (before photos)
✅ Pictures appear in corrective actions table (after photos)
✅ C1-C4 scores show real data, not "-"
✅ Comments column populated from multiple field names
✅ Coefficients show blank for NA answers
✅ Corrective actions filter correctly (Coeff !== Value)
✅ Severity auto-calculates when Priority empty
✅ Fridges tables show temperature data with images
✅ Text cleaning works (newlines, tabs)
