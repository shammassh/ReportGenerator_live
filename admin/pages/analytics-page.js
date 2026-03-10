/**
 * Admin Analytics Page Module
 * Advanced Analytics Dashboard with charts and visualizations
 * 
 * Features:
 * 1. Trend Charts - Score trends over time by store/auditor
 * 2. Auditor Performance - Compare auditors by # audits, avg scores
 * 3. Section Analysis Report - Drill-down analysis with per-store/audit breakdown and criteria details
 * 4. Heatmap - Visual grid of stores vs sections showing problem areas
 */

class AnalyticsPage {
    /**
     * Render the analytics page
     */
    static render(req, res) {
        const user = req.currentUser;
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Analytics - Food Safety Audit System</title>
    <link rel="stylesheet" href="/admin/styles/analytics.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div class="logo-section">
                <h1>📈 Advanced Analytics</h1>
                <p class="subtitle">Performance insights and audit analytics</p>
            </div>
            <div class="user-section">
                <span class="user-name">${user.displayName || user.email}</span>
                <span class="user-role badge-admin">Admin</span>
                <a href="/admin/users" class="btn-secondary">👥 Users</a>
                <a href="/dashboard" class="btn-secondary">Back to Dashboard</a>
                <a href="/auth/logout" class="btn-logout">Logout</a>
            </div>
        </div>
    </header>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Loading analytics data...</p>
    </div>

    <!-- Main Content -->
    <main class="container">
        <!-- Filter Section - At Top -->
        <section class="filter-section">
            <div class="filter-row">
                <div class="filter-group">
                    <label>Country:</label>
                    <div class="multi-select-dropdown" id="countryDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('countryDropdown')">
                            <span class="selected-text">All Countries</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="countryOptions">
                            <label class="checkbox-option">
                                <input type="checkbox" value="Lebanon" onchange="updateDropdownText('countryDropdown'); onCountryChange()"> 🇱🇧 Lebanon
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="Iraq" onchange="updateDropdownText('countryDropdown'); onCountryChange()"> 🇮🇶 Iraq
                            </label>
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Scheme:</label>
                    <div class="multi-select-dropdown" id="schemeDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('schemeDropdown')">
                            <span class="selected-text">All Schemes</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="schemeOptions">
                            <!-- Options populated dynamically from brands -->
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Stores:</label>
                    <div class="multi-select-dropdown" id="storeDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('storeDropdown')">
                            <span class="selected-text">All Stores</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="storeOptions">
                            <!-- Options populated dynamically -->
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Head of Operations:</label>
                    <div class="multi-select-dropdown" id="headOfOpsDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('headOfOpsDropdown')">
                            <span class="selected-text">All Head of Ops</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="headOfOpsOptions">
                            <!-- Options populated dynamically -->
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Area Managers:</label>
                    <div class="multi-select-dropdown" id="areaManagerDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('areaManagerDropdown')">
                            <span class="selected-text">All Area Managers</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="areaManagerOptions">
                            <!-- Options populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-row">
                <div class="filter-group">
                    <label>Result:</label>
                    <div class="multi-select-dropdown" id="resultDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('resultDropdown')">
                            <span class="selected-text">All Results</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="resultOptions">
                            <label class="checkbox-option">
                                <input type="checkbox" value="pass" onchange="updateDropdownText('resultDropdown'); refreshAnalytics()"> ✅ Pass
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="fail" onchange="updateDropdownText('resultDropdown'); refreshAnalytics()"> ❌ Fail
                            </label>
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Year:</label>
                    <div class="multi-select-dropdown" id="yearDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('yearDropdown')">
                            <span class="selected-text">All Years</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="yearOptions">
                            <!-- Options populated dynamically -->
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Months:</label>
                    <div class="multi-select-dropdown" id="monthDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('monthDropdown')">
                            <span class="selected-text">All Months</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="monthOptions">
                            <label class="checkbox-option">
                                <input type="checkbox" value="1" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> January
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="2" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> February
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="3" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> March
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="4" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> April
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="5" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> May
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="6" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> June
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="7" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> July
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="8" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> August
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="9" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> September
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="10" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> October
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="11" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> November
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" value="12" onchange="updateDropdownText('monthDropdown'); refreshAnalytics()"> December
                            </label>
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <label>Cycles:</label>
                    <div class="multi-select-dropdown" id="cycleDropdown">
                        <div class="multi-select-header" onclick="toggleDropdown('cycleDropdown')">
                            <span class="selected-text">All Cycles</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="multi-select-options" id="cycleOptions">
                            <!-- Cycles populated dynamically from cycle management -->
                        </div>
                    </div>
                </div>
                <button class="btn-refresh" onclick="refreshAnalytics()">🔄 Refresh</button>
                <button class="btn-clear" onclick="clearAllFilters()">✖ Clear</button>
            </div>
        </section>

        <!-- Summary Cards -->
        <section class="summary-cards">
            <div class="summary-card">
                <div class="card-icon">📊</div>
                <div class="card-content">
                    <h3 id="totalAudits">-</h3>
                    <p>Total Audits</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="card-icon">🏪</div>
                <div class="card-content">
                    <h3 id="totalStores">-</h3>
                    <p>Number of Selected Stores</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="card-icon">📈</div>
                <div class="card-content">
                    <h3 id="avgScore">-</h3>
                    <p>Average Score</p>
                </div>
            </div>
            <div class="summary-card pass">
                <div class="card-icon">✅</div>
                <div class="card-content">
                    <h3 id="passRate">-</h3>
                    <p>Pass Rate <span id="passCount" class="rate-count"></span></p>
                </div>
            </div>
            <div class="summary-card fail">
                <div class="card-icon">❌</div>
                <div class="card-content">
                    <h3 id="failRate">-</h3>
                    <p>Fail Rate <span id="failCount" class="rate-count"></span></p>
                </div>
            </div>
            <div class="summary-card clickable" onclick="showUnsolvedActionPlans()" title="Click to view unsolved items">
                <div class="card-icon">📝</div>
                <div class="card-content">
                    <h3 id="actionPlanCompletion">-</h3>
                    <p>Number of Findings Solved</p>
                    <span class="click-hint">Click to view unsolved ➡️</span>
                </div>
            </div>
        </section>

        <!-- Custom Query Builder -->
        <section class="query-builder-section">
            <h2>🔍 Custom Query Builder - Ask Your Own Questions</h2>
            <div class="query-builder">
                <div class="query-row">
                    <div class="query-group">
                        <label>I want to see:</label>
                        <select id="querySubject" onchange="updateQueryOptions()">
                            <option value="">-- Select --</option>
                            <option value="stores">🏪 Stores</option>
                            <option value="auditors">👥 Auditors</option>
                            <option value="sections">📋 Sections</option>
                            <option value="items">📝 Checklist Items</option>
                        </select>
                    </div>
                    <div class="query-group">
                        <label>With:</label>
                        <select id="queryMetric">
                            <option value="">-- Select metric --</option>
                            <option value="most_fails">Most Fails</option>
                            <option value="most_audits">Most Audits</option>
                            <option value="lowest_score">Lowest Score</option>
                            <option value="highest_score">Highest Score</option>
                            <option value="most_repetitive">Most Repetitive Issues</option>
                            <option value="never_pass">Never Passed</option>
                            <option value="always_pass">Always Passed</option>
                            <option value="biggest_drop">Biggest Score Drop</option>
                            <option value="biggest_improvement">Biggest Improvement</option>
                        </select>
                    </div>
                    <div class="query-group">
                        <label>Show Top:</label>
                        <select id="queryLimit">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                    <button class="btn-query" onclick="runCustomQuery()">🚀 Run Query</button>
                </div>
                
                <!-- Quick Questions -->
                <div class="quick-questions">
                    <span class="quick-label">Quick Questions:</span>
                    <button class="quick-btn" onclick="quickQuery('stores', 'most_fails')">🏪 Stores with most fails</button>
                    <button class="quick-btn" onclick="quickQuery('items', 'most_repetitive')">📝 Most repetitive failing items</button>
                    <button class="quick-btn" onclick="quickQuery('auditors', 'most_audits')">👥 Most active auditors</button>
                    <button class="quick-btn" onclick="quickQuery('sections', 'lowest_score')">📋 Weakest sections</button>
                    <button class="quick-btn" onclick="quickQuery('stores', 'biggest_improvement')">📈 Most improved stores</button>
                    <button class="quick-btn" onclick="quickQuery('stores', 'never_pass')">❌ Stores that never passed</button>
                </div>
            </div>
            
            <!-- Query Results -->
            <div id="queryResults" class="query-results" style="display: none;">
                <div class="results-header">
                    <h3 id="queryResultsTitle">Results</h3>
                    <button class="btn-export" onclick="exportQueryResults()">📥 Export</button>
                </div>
                <div id="queryResultsChart" class="query-chart-container">
                    <canvas id="customQueryChart"></canvas>
                </div>
                <div id="queryResultsTable" class="query-table-container"></div>
            </div>
        </section>

        <!-- Charts Grid -->
        <div class="charts-grid">
            <!-- Trend Chart -->
            <section class="chart-card full-width">
                <h2>📈 Score Trends Over Time</h2>
                <div class="chart-container large">
                    <canvas id="trendChart"></canvas>
                </div>
            </section>

            <!-- Auditor Performance -->
            <section class="chart-card">
                <h2>👥 Auditor Performance</h2>
                <div class="chart-container">
                    <canvas id="auditorChart"></canvas>
                </div>
                <div id="auditorTable" class="data-table-container"></div>
            </section>

            <!-- Section Analysis -->
            <section class="chart-card">
                <h2>📊 Section Analysis Report</h2>
                <div class="chart-container">
                    <canvas id="sectionChart"></canvas>
                </div>
                <div id="sectionTable" class="data-table-container"></div>
            </section>

            <!-- Heatmap -->
            <section class="chart-card full-width">
                <h2>🗺️ Store vs Section Heatmap</h2>
                <div class="heatmap-controls">
                    <div class="heatmap-view-toggle">
                        <label>View Mode:</label>
                        <select id="heatmapViewMode" onchange="changeHeatmapView()">
                            <option value="average">Average (All Cycles)</option>
                            <option value="by-cycle">Per Cycle Breakdown</option>
                        </select>
                    </div>
                    <div class="heatmap-cycle-select" id="heatmapCycleSelect" style="display: none;">
                        <label>Show Cycles:</label>
                        <select id="heatmapCycles" multiple size="4" onchange="updateHeatmapCycles()">
                            <!-- Populated dynamically -->
                        </select>
                        <button class="btn-small" onclick="selectAllHeatmapCycles()">Select All</button>
                    </div>
                </div>
                <div class="heatmap-container" id="heatmapContainer">
                    <p class="loading-text">Loading heatmap...</p>
                </div>
            </section>

            <!-- Non-conformities Analysis -->
            <section class="chart-card full-width">
                <h2>🚫 Non-conformities Analysis</h2>
                
                <!-- Audits with N/C Summary Table -->
                <div class="nc-section">
                    <h3>📋 Audits Summary</h3>
                    <div id="ncAuditTable" class="data-table-container">
                        <p class="loading-text">Loading audit data...</p>
                    </div>
                </div>
                
                <!-- Repetitive Findings -->
                <div class="nc-section">
                    <h3>🔄 Repetitive Findings (Across All Cycles)</h3>
                    <p class="nc-description">Findings that appear in multiple audits for the same store at the same reference point.</p>
                    <div id="repetitiveFindingsTable" class="data-table-container">
                        <p class="loading-text">Loading repetitive findings...</p>
                    </div>
                </div>
            </section>
        </div>
    </main>

    <!-- Unsolved Action Plans Modal -->
    <div id="unsolvedModal" class="modal-overlay" style="display: none;">
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>📝 Unsolved Action Plan Items</h2>
                <button class="modal-close" onclick="closeUnsolvedModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-filters">
                    <input type="text" id="unsolvedSearch" placeholder="🔍 Search store, question, finding..." oninput="filterUnsolvedItems()">
                    <select id="unsolvedPriorityFilter" onchange="filterUnsolvedItems()">
                        <option value="">All Priorities</option>
                        <option value="High">🔴 High</option>
                        <option value="Medium">🟡 Medium</option>
                        <option value="Low">🟢 Low</option>
                    </select>
                    <select id="unsolvedStatusFilter" onchange="filterUnsolvedItems()">
                        <option value="">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending">Pending</option>
                        <option value="Deferred">Deferred</option>
                    </select>
                </div>
                <div class="modal-stats">
                    <span id="unsolvedCount">Loading...</span>
                </div>
                <div class="unsolved-table-container" id="unsolvedTableContainer">
                    <p class="loading-text">Loading unsolved items...</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Chart instances
        let trendChart = null;
        let auditorChart = null;
        let sectionChart = null;

        // Data cache
        let analyticsData = null;

        // Initialize page
        document.addEventListener('DOMContentLoaded', async () => {
            await initFilters();
            await loadAnalytics();
        });

        // Unsolved action plans data
        let unsolvedItems = [];

        // Show unsolved action plans modal
        async function showUnsolvedActionPlans() {
            document.getElementById('unsolvedModal').style.display = 'flex';
            document.getElementById('unsolvedTableContainer').innerHTML = '<p class="loading-text">Loading unsolved items...</p>';
            
            try {
                const response = await fetch('/api/admin/analytics/unsolved-action-plans');
                const data = await response.json();
                
                if (data.success) {
                    unsolvedItems = data.items;
                    document.getElementById('unsolvedCount').textContent = data.count + ' unsolved items';
                    renderUnsolvedTable(unsolvedItems);
                } else {
                    document.getElementById('unsolvedTableContainer').innerHTML = '<p class="error-text">Error loading data</p>';
                }
            } catch (error) {
                console.error('Error loading unsolved items:', error);
                document.getElementById('unsolvedTableContainer').innerHTML = '<p class="error-text">Error: ' + error.message + '</p>';
            }
        }

        // Close modal
        function closeUnsolvedModal() {
            document.getElementById('unsolvedModal').style.display = 'none';
        }

        // Filter unsolved items
        function filterUnsolvedItems() {
            const search = document.getElementById('unsolvedSearch').value.toLowerCase();
            const priority = document.getElementById('unsolvedPriorityFilter').value;
            const status = document.getElementById('unsolvedStatusFilter').value;
            
            const filtered = unsolvedItems.filter(item => {
                const matchesSearch = !search || 
                    (item.StoreName || '').toLowerCase().includes(search) ||
                    (item.SectionName || '').toLowerCase().includes(search) ||
                    (item.Finding || '').toLowerCase().includes(search) ||
                    (item.DocumentNumber || '').toLowerCase().includes(search) ||
                    (item.PersonInCharge || '').toLowerCase().includes(search);
                const matchesPriority = !priority || item.Priority === priority;
                const matchesStatus = !status || item.Status === status;
                return matchesSearch && matchesPriority && matchesStatus;
            });
            
            document.getElementById('unsolvedCount').textContent = filtered.length + ' of ' + unsolvedItems.length + ' items';
            renderUnsolvedTable(filtered);
        }

        // Render unsolved table
        function renderUnsolvedTable(items) {
            if (items.length === 0) {
                document.getElementById('unsolvedTableContainer').innerHTML = '<p class="empty-text">🎉 No unsolved action plan items found!</p>';
                return;
            }
            
            const html = \`
                <table class="unsolved-table">
                    <thead>
                        <tr>
                            <th>Store</th>
                            <th>Document</th>
                            <th>Section</th>
                            <th>Ref</th>
                            <th>Finding</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Person In Charge</th>
                            <th>Deadline</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${items.map(item => \`
                            <tr class="priority-\${(item.Priority || 'none').toLowerCase()}">
                                <td>\${item.StoreName || '-'}</td>
                                <td>\${item.DocumentNumber || '-'}</td>
                                <td>\${item.SectionName || '-'}</td>
                                <td>\${item.ReferenceValue || '-'}</td>
                                <td class="finding-cell" title="\${item.Finding || ''}">\${truncate(item.Finding, 50)}</td>
                                <td><span class="priority-badge priority-\${(item.Priority || 'none').toLowerCase()}">\${item.Priority || 'N/A'}</span></td>
                                <td><span class="status-badge status-\${(item.Status || 'open').toLowerCase().replace(' ', '-')}">\${item.Status || 'Open'}</span></td>
                                <td>\${item.PersonInCharge || '-'}</td>
                                <td>\${item.Deadline ? new Date(item.Deadline).toLocaleDateString() : '-'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('unsolvedTableContainer').innerHTML = html;
        }

        // Truncate text helper
        function truncate(text, maxLength) {
            if (!text) return '-';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        }

        // Close modal on overlay click
        document.getElementById('unsolvedModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'unsolvedModal') closeUnsolvedModal();
        });

        // Global store list for filtering
        let allStores = [];
        let allHeadOfOps = [];
        let allAreaManagers = [];

        // Initialize filter dropdowns
        async function initFilters() {
            try {
                console.log('Initializing filters...');
                
                // Load brands (now called Schemes)
                const brandsResponse = await fetch('/api/admin/brands');
                console.log('Brands/Schemes response:', brandsResponse.status);
                if (brandsResponse.ok) {
                    const brands = await brandsResponse.json();
                    console.log('Loaded schemes:', brands);
                    const schemeOptions = document.getElementById('schemeOptions');
                    schemeOptions.innerHTML = '';
                    brands.forEach(brand => {
                        const label = document.createElement('label');
                        label.className = 'checkbox-option';
                        label.innerHTML = \`
                            <input type="checkbox" value="\${brand}" onchange="updateDropdownText('schemeDropdown'); onSchemeChange()"> \${brand}
                        \`;
                        schemeOptions.appendChild(label);
                    });
                } else {
                    console.error('Failed to load schemes:', brandsResponse.status);
                }

                // Load stores
                const storesResponse = await fetch('/api/admin/stores');
                console.log('Stores response status:', storesResponse.status);
                if (storesResponse.ok) {
                    const storesData = await storesResponse.json();
                    // Handle both array and {stores: [...]} formats
                    allStores = Array.isArray(storesData) ? storesData : (storesData.stores || []);
                    console.log('Loaded stores:', allStores.length, 'First store:', allStores[0]);
                    populateStoreDropdown(allStores);
                } else {
                    console.error('Failed to load stores:', await storesResponse.text());
                }

                // Load Head of Operations
                try {
                    const headOfOpsResponse = await fetch('/api/admin/head-of-operations');
                    if (headOfOpsResponse.ok) {
                        allHeadOfOps = await headOfOpsResponse.json();
                        populateHeadOfOpsDropdown(allHeadOfOps);
                    }
                } catch (e) {
                    console.warn('Could not load Head of Operations:', e);
                }

                // Load Area Managers
                try {
                    const areaManagersResponse = await fetch('/api/admin/area-managers');
                    if (areaManagersResponse.ok) {
                        allAreaManagers = await areaManagersResponse.json();
                        populateAreaManagerDropdown(allAreaManagers);
                    }
                } catch (e) {
                    console.warn('Could not load Area Managers:', e);
                }

                // Load Cycles from cycle management
                try {
                    const cyclesResponse = await fetch('/api/admin/cycles');
                    if (cyclesResponse.ok) {
                        const cycles = await cyclesResponse.json();
                        populateCycleDropdown(cycles);
                    }
                } catch (e) {
                    console.warn('Could not load cycles:', e);
                }

                // Load years
                const currentYear = new Date().getFullYear();
                const yearOptions = document.getElementById('yearOptions');
                yearOptions.innerHTML = '';
                for (let y = currentYear; y >= currentYear - 5; y--) {
                    const label = document.createElement('label');
                    label.className = 'checkbox-option';
                    label.innerHTML = \`
                        <input type="checkbox" value="\${y}" onchange="updateDropdownText('yearDropdown'); refreshAnalytics()"> \${y}
                    \`;
                    yearOptions.appendChild(label);
                }
            } catch (error) {
                console.error('Error initializing filters:', error);
            }
        }

        // Populate Cycle dropdown
        function populateCycleDropdown(cycles) {
            const options = document.getElementById('cycleOptions');
            options.innerHTML = '';
            cycles.forEach(cycle => {
                const label = document.createElement('label');
                label.className = 'checkbox-option';
                label.innerHTML = \`
                    <input type="checkbox" value="\${cycle}" onchange="updateDropdownText('cycleDropdown'); refreshAnalytics()"> \${cycle}
                \`;
                options.appendChild(label);
            });
            updateDropdownText('cycleDropdown');
        }

        // Populate Head of Operations dropdown
        function populateHeadOfOpsDropdown(headOfOps) {
            const options = document.getElementById('headOfOpsOptions');
            options.innerHTML = '';
            headOfOps.forEach(person => {
                const label = document.createElement('label');
                label.className = 'checkbox-option';
                const name = person.display_name || person.displayName || person.name || 'Unknown';
                const id = person.id || person.user_id || person.userId;
                label.innerHTML = \`
                    <input type="checkbox" value="\${id}" onchange="updateDropdownText('headOfOpsDropdown'); refreshAnalytics()"> \${name}
                \`;
                options.appendChild(label);
            });
            updateDropdownText('headOfOpsDropdown');
        }

        // Populate Area Manager dropdown
        function populateAreaManagerDropdown(areaManagers) {
            const options = document.getElementById('areaManagerOptions');
            options.innerHTML = '';
            areaManagers.forEach(person => {
                const label = document.createElement('label');
                label.className = 'checkbox-option';
                const name = person.display_name || person.displayName || person.name || 'Unknown';
                const id = person.id || person.user_id || person.userId;
                label.innerHTML = \`
                    <input type="checkbox" value="\${id}" onchange="updateDropdownText('areaManagerDropdown'); refreshAnalytics()"> \${name}
                \`;
                options.appendChild(label);
            });
            updateDropdownText('areaManagerDropdown');
        }

        // Populate store dropdown with filtered stores
        function populateStoreDropdown(stores) {
            const storeOptions = document.getElementById('storeOptions');
            storeOptions.innerHTML = ''; // Clear existing
            
            stores.forEach(store => {
                const label = document.createElement('label');
                label.className = 'checkbox-option';
                const storeId = store.store_id || store.StoreID || store.storeId;
                const storeName = store.store_name || store.StoreName || store.storeName || 'Unknown';
                const brand = store.brand || store.Brand || '';
                const displayName = brand ? storeName + ' (' + brand + ')' : storeName;
                label.innerHTML = \`
                    <input type="checkbox" value="\${storeId}" onchange="updateDropdownText('storeDropdown'); refreshAnalytics()"> \${displayName}
                \`;
                storeOptions.appendChild(label);
            });
            
            updateDropdownText('storeDropdown');
        }

        // Filter stores when scheme (brand) changes
        function onSchemeChange() {
            const schemeCheckboxes = document.querySelectorAll('#schemeOptions input[type="checkbox"]:checked');
            const selectedSchemes = Array.from(schemeCheckboxes).map(cb => cb.value);
            
            if (selectedSchemes.length > 0) {
                const filteredStores = allStores.filter(store => 
                    selectedSchemes.includes(store.Brand || store.brand)
                );
                populateStoreDropdown(filteredStores);
            } else {
                populateStoreDropdown(allStores);
            }
            
            refreshAnalytics();
        }

        // Filter when country changes
        function onCountryChange() {
            const countryCheckboxes = document.querySelectorAll('#countryOptions input[type="checkbox"]:checked');
            const selectedCountries = Array.from(countryCheckboxes).map(cb => cb.value);
            
            if (selectedCountries.length > 0) {
                const filteredStores = allStores.filter(store => 
                    selectedCountries.includes(store.Country || store.country)
                );
                populateStoreDropdown(filteredStores);
            } else {
                populateStoreDropdown(allStores);
            }
            
            refreshAnalytics();
        }

        // Clear all filters
        function clearAllFilters() {
            // Uncheck all checkboxes in all dropdowns
            document.querySelectorAll('.multi-select-options input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Reset dropdown texts
            ['countryDropdown', 'schemeDropdown', 'storeDropdown', 'headOfOpsDropdown', 'areaManagerDropdown', 
             'resultDropdown', 'yearDropdown', 'monthDropdown', 'cycleDropdown'].forEach(id => {
                updateDropdownText(id);
            });
            
            // Repopulate stores
            populateStoreDropdown(allStores);
            
            refreshAnalytics();
        }

        // Get current filter values
        function getFilters() {
            // Get multiple selected countries
            const countryCheckboxes = document.querySelectorAll('#countryOptions input[type="checkbox"]:checked');
            const selectedCountries = Array.from(countryCheckboxes).map(cb => cb.value);
            
            // Get multiple selected schemes (formerly brands)
            const schemeCheckboxes = document.querySelectorAll('#schemeOptions input[type="checkbox"]:checked');
            const selectedSchemes = Array.from(schemeCheckboxes).map(cb => cb.value);
            
            // Get multiple selected store IDs from checkboxes
            const storeCheckboxes = document.querySelectorAll('#storeOptions input[type="checkbox"]:checked');
            const selectedStores = Array.from(storeCheckboxes).map(cb => cb.value);
            
            // Get multiple selected Head of Operations
            const headOfOpsCheckboxes = document.querySelectorAll('#headOfOpsOptions input[type="checkbox"]:checked');
            const selectedHeadOfOps = Array.from(headOfOpsCheckboxes).map(cb => cb.value);
            
            // Get multiple selected Area Managers
            const areaManagerCheckboxes = document.querySelectorAll('#areaManagerOptions input[type="checkbox"]:checked');
            const selectedAreaManagers = Array.from(areaManagerCheckboxes).map(cb => cb.value);
            
            // Get multiple selected results
            const resultCheckboxes = document.querySelectorAll('#resultOptions input[type="checkbox"]:checked');
            const selectedResults = Array.from(resultCheckboxes).map(cb => cb.value);
            
            // Get multiple selected years
            const yearCheckboxes = document.querySelectorAll('#yearOptions input[type="checkbox"]:checked');
            const selectedYears = Array.from(yearCheckboxes).map(cb => cb.value);
            
            // Get multiple selected months from checkboxes
            const monthCheckboxes = document.querySelectorAll('#monthOptions input[type="checkbox"]:checked');
            const selectedMonths = Array.from(monthCheckboxes).map(cb => cb.value);
            
            // Get multiple selected cycles from checkboxes
            const cycleCheckboxes = document.querySelectorAll('#cycleOptions input[type="checkbox"]:checked');
            const selectedCycles = Array.from(cycleCheckboxes).map(cb => cb.value);
            
            return {
                countries: selectedCountries.join(','),
                brands: selectedSchemes.join(','),  // API still uses 'brands' param
                storeIds: selectedStores.join(','),
                headOfOpsIds: selectedHeadOfOps.join(','),
                areaManagerIds: selectedAreaManagers.join(','),
                results: selectedResults.join(','),
                years: selectedYears.join(','),
                months: selectedMonths.join(','),
                cycles: selectedCycles.join(',')
            };
        }

        // Toggle multi-select dropdown
        function toggleDropdown(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            const options = dropdown.querySelector('.multi-select-options');
            const isOpen = options.classList.contains('open');
            
            // Close all other dropdowns first
            document.querySelectorAll('.multi-select-options.open').forEach(el => {
                el.classList.remove('open');
            });
            
            if (!isOpen) {
                options.classList.add('open');
            }
        }

        // Update dropdown header text based on selections
        function updateDropdownText(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            if (!dropdown) return;
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
            const textSpan = dropdown.querySelector('.selected-text');
            
            const defaultTexts = {
                'countryDropdown': 'All Countries',
                'schemeDropdown': 'All Schemes',
                'storeDropdown': 'All Stores',
                'headOfOpsDropdown': 'All Head of Ops',
                'areaManagerDropdown': 'All Area Managers',
                'resultDropdown': 'All Results',
                'yearDropdown': 'All Years',
                'monthDropdown': 'All Months',
                'cycleDropdown': 'All Cycles'
            };
            
            if (checkboxes.length === 0) {
                textSpan.textContent = defaultTexts[dropdownId] || 'All';
            } else if (checkboxes.length === 1) {
                textSpan.textContent = checkboxes[0].parentElement.textContent.trim();
            } else {
                textSpan.textContent = checkboxes.length + ' selected';
            }
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.multi-select-dropdown')) {
                document.querySelectorAll('.multi-select-options.open').forEach(el => {
                    el.classList.remove('open');
                });
            }
        });

        // Load all analytics data
        async function loadAnalytics() {
            showLoading(true);
            try {
                const filters = getFilters();
                const queryParams = new URLSearchParams(filters).toString();

                const response = await fetch('/api/admin/analytics?' + queryParams);
                if (!response.ok) throw new Error('Failed to load analytics');
                
                analyticsData = await response.json();
                
                renderSummaryCards(analyticsData.summary);
                renderTrendChart(analyticsData.trends);
                renderAuditorPerformance(analyticsData.auditorPerformance);
                renderSectionAnalysis(analyticsData.sectionWeakness, analyticsData.sectionDrilldown);
                renderHeatmap(analyticsData.heatmap);
                renderNCAnalysis(analyticsData.ncAnalysis);
            } catch (error) {
                console.error('Error loading analytics:', error);
                alert('Error loading analytics: ' + error.message);
            } finally {
                showLoading(false);
            }
        }

        // Refresh analytics with current filters
        function refreshAnalytics() {
            loadAnalytics();
        }

        // Show/hide loading overlay
        function showLoading(show) {
            document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
        }

        // Render summary cards
        function renderSummaryCards(summary) {
            const totalAudits = summary.totalAudits || 0;
            const failedAudits = summary.failedAudits || 0;
            const passedAudits = totalAudits - failedAudits;
            const passRate = summary.passRate || 0;
            const failRate = totalAudits > 0 ? (failedAudits * 100.0 / totalAudits) : 0;
            
            document.getElementById('totalAudits').textContent = totalAudits;
            document.getElementById('totalStores').textContent = summary.totalStores || 0;
            document.getElementById('avgScore').textContent = (summary.avgScore || 0).toFixed(1) + '%';
            
            // Pass Rate with count (e.g., "85.5%" with "10/12" below)
            document.getElementById('passRate').textContent = passRate.toFixed(1) + '%';
            document.getElementById('passCount').textContent = '(' + passedAudits + '/' + totalAudits + ')';
            
            // Fail Rate with count (e.g., "14.5%" with "2/12" below)
            document.getElementById('failRate').textContent = failRate.toFixed(1) + '%';
            document.getElementById('failCount').textContent = '(' + failedAudits + '/' + totalAudits + ')';
            
            // Action Plan Completion: show as "X/Y (Z%)"
            const solved = summary.actionPlansSolved || 0;
            const total = summary.actionPlansTotal || 0;
            const percentage = summary.actionPlanCompletionRate || 0;
            if (total > 0) {
                document.getElementById('actionPlanCompletion').textContent = solved + '/' + total + ' (' + percentage.toFixed(1) + '%)';
            } else {
                document.getElementById('actionPlanCompletion').textContent = '0/0 (0%)';
            }
        }

        // Render trend chart
        function renderTrendChart(trends) {
            const ctx = document.getElementById('trendChart').getContext('2d');
            
            if (trendChart) trendChart.destroy();

            const labels = trends.map(t => t.period);
            const scores = trends.map(t => t.avgScore);
            const counts = trends.map(t => t.auditCount);

            trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Average Score (%)',
                            data: scores,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Audit Count',
                            data: counts,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: false,
                            tension: 0.4,
                            yAxisID: 'y1',
                            type: 'bar'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            position: 'left',
                            min: 0,
                            max: 100,
                            title: { display: true, text: 'Score (%)' }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            title: { display: true, text: 'Audit Count' },
                            grid: { drawOnChartArea: false }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    if (context.dataset.label === 'Average Score (%)') {
                                        return 'Avg Score: ' + context.parsed.y.toFixed(1) + '%';
                                    }
                                    return 'Audits: ' + context.parsed.y;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Render auditor performance
        function renderAuditorPerformance(auditors) {
            const ctx = document.getElementById('auditorChart').getContext('2d');
            
            if (auditorChart) auditorChart.destroy();

            const labels = auditors.map(a => a.auditorName);
            const scores = auditors.map(a => a.avgScore);
            const counts = auditors.map(a => a.auditCount);

            // Color based on performance
            const colors = scores.map(s => s >= 83 ? '#10b981' : '#ef4444');

            auditorChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Score (%)',
                        data: scores,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    scales: {
                        x: {
                            min: 0,
                            max: 100,
                            title: { display: true, text: 'Average Score (%)' }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const auditor = auditors[context.dataIndex];
                                    return [
                                        'Avg Score: ' + auditor.avgScore.toFixed(1) + '%',
                                        'Audits: ' + auditor.auditCount
                                    ];
                                }
                            }
                        }
                    }
                }
            });

            // Render table
            const tableHtml = \`
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Auditor</th>
                            <th>Audits</th>
                            <th>Avg Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${auditors.map(a => \`
                            <tr>
                                <td>\${a.auditorName}</td>
                                <td>\${a.auditCount}</td>
                                <td class="\${a.avgScore >= 83 ? 'pass' : 'fail'}">\${a.avgScore.toFixed(1)}%</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('auditorTable').innerHTML = tableHtml;
        }

        // Store drilldown data for section analysis
        let currentSectionDrilldown = {};

        // Render section analysis report (enhanced version)
        function renderSectionAnalysis(sections, drilldown) {
            currentSectionDrilldown = drilldown || {};
            const ctx = document.getElementById('sectionChart').getContext('2d');
            
            if (sectionChart) sectionChart.destroy();

            // Sort by average score (weakest first)
            const sorted = [...sections].sort((a, b) => a.avgScore - b.avgScore);
            
            const labels = sorted.map(s => s.sectionName);
            const scores = sorted.map(s => s.avgScore);

            const colors = scores.map(s => s >= 83 ? '#10b981' : '#ef4444');

            sectionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Score (%)',
                        data: scores,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    scales: {
                        x: {
                            min: 0,
                            max: 100,
                            title: { display: true, text: 'Average Score (%)' }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const section = sorted[context.dataIndex];
                                    return [
                                        'Avg Score: ' + section.avgScore.toFixed(1) + '%',
                                        'Pass Rate: ' + (section.passRate || 0).toFixed(1) + '%',
                                        'Fail Rate: ' + section.failRate.toFixed(1) + '%',
                                        'Times Audited: ' + section.timesAudited
                                    ];
                                }
                            }
                        }
                    }
                }
            });

            // Render enhanced table with expandable rows
            const tableHtml = \`
                <table class="data-table section-analysis-table">
                    <thead>
                        <tr>
                            <th style="width: 30px;"></th>
                            <th>Section</th>
                            <th>Audits</th>
                            <th>Average Score</th>
                            <th>Pass Rate</th>
                            <th>Fail Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${sorted.map((s, idx) => {
                            const drilldownData = currentSectionDrilldown[s.sectionName] || [];
                            const hasStores = drilldownData.length > 0;
                            const passCount = Math.round(s.timesAudited * (s.passRate || 0) / 100);
                            const failCount = s.timesAudited - passCount;
                            return \`
                            <tr class="section-row \${hasStores ? 'expandable' : ''}" data-section="\${s.sectionName}" onclick="toggleSectionDrilldown('\${s.sectionName.replace(/'/g, "\\\\'")}')">
                                <td class="expand-icon">\${hasStores ? '▶' : ''}</td>
                                <td><strong>\${s.sectionName}</strong></td>
                                <td>\${s.timesAudited}</td>
                                <td class="\${s.avgScore >= 83 ? 'pass' : 'fail'}">\${s.avgScore.toFixed(1)}%</td>
                                <td class="pass">\${(s.passRate || 0).toFixed(1)}% <span class="rate-count">(\${passCount})</span></td>
                                <td class="fail">\${s.failRate.toFixed(1)}% <span class="rate-count">(\${failCount})</span></td>
                            </tr>
                            <tr class="drilldown-row" id="drilldown-\${s.sectionName.replace(/[^a-zA-Z0-9]/g, '_')}" style="display: none;">
                                <td colspan="6" class="drilldown-cell">
                                    <div class="drilldown-content">
                                        <div class="drilldown-header">
                                            <strong>Store/Audit Breakdown for \${s.sectionName}</strong>
                                            <button class="btn-small" onclick="event.stopPropagation(); loadSectionCriteria('\${s.sectionName.replace(/'/g, "\\\\'")}')">
                                                📋 View Criteria Details
                                            </button>
                                        </div>
                                        \${drilldownData.length > 0 ? \`
                                        <table class="drilldown-table">
                                            <thead>
                                                <tr>
                                                    <th>Store</th>
                                                    <th>Document #</th>
                                                    <th>Audit Date</th>
                                                    <th>Score</th>
                                                    <th>Earned/Max</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                \${drilldownData.map(d => \`
                                                <tr>
                                                    <td>\${d.storeName}</td>
                                                    <td><a href="/reports/\${d.documentNumber}.html" target="_blank">\${d.documentNumber}</a></td>
                                                    <td>\${new Date(d.auditDate).toLocaleDateString()}</td>
                                                    <td class="\${d.score >= 83 ? 'pass' : 'fail'}">\${d.score ? d.score.toFixed(1) : 0}%</td>
                                                    <td>\${d.earnedScore || 0}/\${d.maxScore || 0}</td>
                                                </tr>
                                                \`).join('')}
                                            </tbody>
                                        </table>
                                        \` : '<p class="no-data">No detailed data available</p>'}
                                    </div>
                                </td>
                            </tr>
                        \`;}).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('sectionTable').innerHTML = tableHtml;
        }

        // Toggle section drilldown row
        function toggleSectionDrilldown(sectionName) {
            const rowId = 'drilldown-' + sectionName.replace(/[^a-zA-Z0-9]/g, '_');
            const row = document.getElementById(rowId);
            const sectionRow = document.querySelector(\`tr[data-section="\${sectionName}"]\`);
            const icon = sectionRow?.querySelector('.expand-icon');
            
            if (row) {
                if (row.style.display === 'none') {
                    row.style.display = 'table-row';
                    if (icon) icon.textContent = '▼';
                } else {
                    row.style.display = 'none';
                    if (icon) icon.textContent = '▶';
                }
            }
        }

        // Load criteria details for a section
        async function loadSectionCriteria(sectionName) {
            try {
                const drilldownData = currentSectionDrilldown[sectionName] || [];
                const auditIds = drilldownData.map(d => d.auditId).join(',');
                
                const params = new URLSearchParams({ sectionName });
                if (auditIds) params.append('auditIds', auditIds);
                
                const response = await fetch('/api/admin/analytics/section-criteria?' + params.toString());
                if (!response.ok) throw new Error('Failed to load criteria');
                
                const data = await response.json();
                showCriteriaModal(sectionName, data.criteria);
                
            } catch (error) {
                console.error('Error loading criteria:', error);
                alert('Error loading criteria: ' + error.message);
            }
        }

        // Show criteria modal
        function showCriteriaModal(sectionName, criteria) {
            // Remove existing modal if present
            const existingModal = document.getElementById('criteriaModal');
            if (existingModal) existingModal.remove();
            
            const modalHtml = \`
                <div id="criteriaModal" class="modal-overlay" onclick="closeCriteriaModal(event)">
                    <div class="modal-content modal-large" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h2>📋 Criteria Analysis: \${sectionName}</h2>
                            <button class="modal-close" onclick="closeCriteriaModal()">✕</button>
                        </div>
                        <div class="modal-body">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="width: 60px;">Ref</th>
                                        <th>Criteria/Question</th>
                                        <th style="width: 60px;">Weight</th>
                                        <th style="width: 80px;">Avg Score</th>
                                        <th style="width: 80px;">Pass Rate</th>
                                        <th style="width: 80px;">Fail Rate</th>
                                        <th style="width: 120px;">Responses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    \${criteria.map(c => {
                                        const passRate = 100 - (c.failRate || 0);
                                        const totalResponses = c.yesCount + c.partiallyCount + c.noCount;
                                        return \`
                                        <tr>
                                            <td>\${c.referenceValue || '-'}</td>
                                            <td style="text-align: left; max-width: 400px;">\${c.title}</td>
                                            <td>\${c.weight || 2}</td>
                                            <td class="\${c.avgScore >= 83 ? 'pass' : 'fail'}">\${c.avgScore ? c.avgScore.toFixed(1) : 0}%</td>
                                            <td class="pass">\${passRate.toFixed(1)}%</td>
                                            <td class="\${c.failRate > 20 ? 'fail' : ''}">\${(c.failRate || 0).toFixed(1)}%</td>
                                            <td>
                                                <span class="response-badge yes">✓\${c.yesCount}</span>
                                                <span class="response-badge partial">½\${c.partiallyCount}</span>
                                                <span class="response-badge no">✗\${c.noCount}</span>
                                                \${c.naCount > 0 ? \`<span class="response-badge na">NA\${c.naCount}</span>\` : ''}
                                            </td>
                                        </tr>
                                        \`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            \`;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Close criteria modal
        function closeCriteriaModal(event) {
            if (event && event.target !== event.currentTarget) return;
            const modal = document.getElementById('criteriaModal');
            if (modal) modal.remove();
        }

        // Store heatmap data globally for view switching
        let currentHeatmapData = null;

        // Change heatmap view mode
        function changeHeatmapView() {
            const viewMode = document.getElementById('heatmapViewMode').value;
            const cycleSelect = document.getElementById('heatmapCycleSelect');
            
            if (viewMode === 'by-cycle') {
                cycleSelect.style.display = 'flex';
            } else {
                cycleSelect.style.display = 'none';
            }
            
            renderHeatmap(currentHeatmapData);
        }

        // Select all cycles in heatmap
        function selectAllHeatmapCycles() {
            const select = document.getElementById('heatmapCycles');
            for (let option of select.options) {
                option.selected = true;
            }
            renderHeatmap(currentHeatmapData);
        }

        // Update heatmap when cycles selection changes
        function updateHeatmapCycles() {
            renderHeatmap(currentHeatmapData);
        }

        // Render heatmap
        function renderHeatmap(heatmapData) {
            currentHeatmapData = heatmapData;
            const container = document.getElementById('heatmapContainer');
            
            if (!heatmapData || !heatmapData.stores || heatmapData.stores.length === 0) {
                container.innerHTML = '<p class="no-data">No heatmap data available</p>';
                return;
            }

            const { stores, sections, cycles, data, dataByCycle } = heatmapData;
            const viewMode = document.getElementById('heatmapViewMode')?.value || 'average';
            
            // Populate cycle selector
            const cycleSelect = document.getElementById('heatmapCycles');
            if (cycleSelect && cycles && cycles.length > 0) {
                const currentSelected = Array.from(cycleSelect.selectedOptions).map(o => o.value);
                cycleSelect.innerHTML = cycles.map(c => 
                    \`<option value="\${c}" \${currentSelected.includes(c) || currentSelected.length === 0 ? 'selected' : ''}>\${c}</option>\`
                ).join('');
            }

            if (viewMode === 'by-cycle' && dataByCycle && cycles && cycles.length > 0) {
                // Per-cycle view - show each store's performance per cycle
                const selectedCycles = Array.from(cycleSelect?.selectedOptions || []).map(o => o.value);
                const cyclesToShow = selectedCycles.length > 0 ? selectedCycles : cycles;
                
                let html = \`
                    <div class="heatmap-scroll">
                        <table class="heatmap-table heatmap-cycle-view">
                            <thead>
                                <tr>
                                    <th class="store-header" rowspan="2">Store</th>
                                    \${cyclesToShow.map(c => \`<th class="cycle-header" colspan="1">\${c}</th>\`).join('')}
                                    <th class="overall-header" rowspan="2">Average</th>
                                </tr>
                            </thead>
                            <tbody>
                \`;

                stores.forEach(store => {
                    const storeAvgData = data[store] || {};
                    const storeCycleData = dataByCycle[store] || {};
                    
                    html += \`<tr><td class="store-name">\${store}</td>\`;
                    
                    // Show score for each selected cycle
                    cyclesToShow.forEach(cycle => {
                        const cycleData = storeCycleData[cycle] || {};
                        const score = cycleData._overall;
                        const cellClass = score !== undefined 
                            ? (score >= 83 ? 'cell-pass' : 'cell-fail')
                            : 'cell-na';
                        const displayScore = score !== undefined ? score.toFixed(0) + '%' : '-';
                        html += \`<td class="heatmap-cell \${cellClass}" title="\${store}: \${cycle} - \${displayScore}">\${displayScore}</td>\`;
                    });

                    // Average across all cycles
                    const overall = storeAvgData._overall;
                    const overallClass = overall !== undefined 
                        ? (overall >= 83 ? 'cell-pass' : 'cell-fail')
                        : 'cell-na';
                    const overallDisplay = overall !== undefined ? overall.toFixed(0) + '%' : '-';
                    html += \`<td class="heatmap-cell \${overallClass} overall-cell"><strong>\${overallDisplay}</strong></td>\`;
                    html += \`</tr>\`;
                });

                html += \`
                            </tbody>
                        </table>
                    </div>
                    <div class="heatmap-legend">
                        <span class="legend-item"><span class="legend-color cell-pass"></span> Pass (≥83%)</span>
                        <span class="legend-item"><span class="legend-color cell-fail"></span> Fail (<83%)</span>
                        <span class="legend-item"><span class="legend-color cell-na"></span> No Data</span>
                    </div>
                \`;

                container.innerHTML = html;
            } else {
                // Average view - original heatmap (Store x Section)
                let html = \`
                    <div class="heatmap-scroll">
                        <table class="heatmap-table">
                            <thead>
                                <tr>
                                    <th class="store-header">Store</th>
                                    \${sections.map(s => \`<th class="section-header" title="\${s}">\${s.split(' ').slice(0, 2).join(' ')}</th>\`).join('')}
                                    <th class="overall-header">Overall</th>
                                </tr>
                            </thead>
                            <tbody>
                \`;

                stores.forEach(store => {
                    const storeData = data[store] || {};
                    html += \`<tr><td class="store-name">\${store}</td>\`;
                    
                    sections.forEach(section => {
                        const score = storeData[section];
                        const cellClass = score !== undefined 
                            ? (score >= 83 ? 'cell-pass' : 'cell-fail')
                            : 'cell-na';
                        const displayScore = score !== undefined ? score.toFixed(0) + '%' : '-';
                        html += \`<td class="heatmap-cell \${cellClass}" title="\${store}: \${section} - \${displayScore}">\${displayScore}</td>\`;
                    });

                    const overall = storeData._overall;
                    const overallClass = overall !== undefined 
                        ? (overall >= 83 ? 'cell-pass' : 'cell-fail')
                        : 'cell-na';
                    const overallDisplay = overall !== undefined ? overall.toFixed(0) + '%' : '-';
                    html += \`<td class="heatmap-cell \${overallClass} overall-cell">\${overallDisplay}</td>\`;
                    html += \`</tr>\`;
                });

                html += \`
                            </tbody>
                        </table>
                    </div>
                    <div class="heatmap-legend">
                        <span class="legend-item"><span class="legend-color cell-pass"></span> Pass (≥83%)</span>
                        <span class="legend-item"><span class="legend-color cell-fail"></span> Fail (<83%)</span>
                        <span class="legend-item"><span class="legend-color cell-na"></span> No Data</span>
                    </div>
                \`;

                container.innerHTML = html;
            }
        }

        // Render compliance calendar
        function renderComplianceCalendar(calendarData) {
            const container = document.getElementById('calendarContainer');
            
            if (!calendarData || calendarData.length === 0) {
                container.innerHTML = '<p class="no-data">No compliance data available</p>';
                return;
            }

            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const sixtyDaysAgo = new Date(today);
            sixtyDaysAgo.setDate(today.getDate() - 60);

            let html = \`
                <div class="calendar-grid">
                    \${calendarData.map(store => {
                        const lastAudit = store.lastAuditDate ? new Date(store.lastAuditDate) : null;
                        let statusClass = 'status-danger';
                        let statusText = 'Never audited';
                        let daysSince = null;

                        if (lastAudit) {
                            daysSince = Math.floor((today - lastAudit) / (1000 * 60 * 60 * 24));
                            if (daysSince <= 30) {
                                statusClass = 'status-good';
                                statusText = daysSince + ' days ago';
                            } else if (daysSince <= 60) {
                                statusClass = 'status-warning';
                                statusText = daysSince + ' days ago';
                            } else {
                                statusClass = 'status-danger';
                                statusText = daysSince + ' days ago';
                            }
                        }

                        return \`
                            <div class="calendar-card \${statusClass}">
                                <div class="store-icon">🏪</div>
                                <h3>\${store.storeName}</h3>
                                <p class="last-audit-date">\${lastAudit ? lastAudit.toLocaleDateString() : 'Never'}</p>
                                <p class="status-text">\${statusText}</p>
                                <p class="audit-count">\${store.totalAudits || 0} total audits</p>
                                \${store.lastScore !== null ? \`<p class="last-score \${store.lastScore >= 83 ? 'pass' : 'fail'}">Last: \${store.lastScore}%</p>\` : ''}
                            </div>
                        \`;
                    }).join('')}
                </div>
                <div class="calendar-legend">
                    <span class="legend-item"><span class="legend-dot status-good"></span> Audited within 30 days</span>
                    <span class="legend-item"><span class="legend-dot status-warning"></span> 31-60 days ago</span>
                    <span class="legend-item"><span class="legend-dot status-danger"></span> Over 60 days / Never</span>
                </div>
            \`;

            container.innerHTML = html;
        }

        // =============================================
        // NON-CONFORMITIES ANALYSIS
        // =============================================
        
        function renderNCAnalysis(ncAnalysis) {
            if (!ncAnalysis) {
                document.getElementById('ncAuditTable').innerHTML = '<p class="no-data">No data available</p>';
                document.getElementById('repetitiveFindingsTable').innerHTML = '<p class="no-data">No data available</p>';
                return;
            }
            
            const { audits, repetitiveFindings, summary } = ncAnalysis;
            
            // Render Audits Summary Table
            let auditsHtml = \`
                <div class="nc-summary-stats">
                    <div class="nc-stat">
                        <span class="nc-stat-value">\${summary.totalAudits}</span>
                        <span class="nc-stat-label">Total Audits</span>
                    </div>
                    <div class="nc-stat">
                        <span class="nc-stat-value">\${summary.totalNC}</span>
                        <span class="nc-stat-label">Total N/C</span>
                    </div>
                    <div class="nc-stat">
                        <span class="nc-stat-value">\${summary.avgNCPerAudit}</span>
                        <span class="nc-stat-label">Avg N/C per Audit</span>
                    </div>
                </div>
                <table class="data-table nc-audit-table">
                    <thead>
                        <tr>
                            <th>Store</th>
                            <th>Audit #</th>
                            <th>Report</th>
                            <th>Date</th>
                            <th>Cycle</th>
                            <th>Result</th>
                            <th>Score</th>
                            <th>N/C</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${audits.length > 0 ? audits.map(a => \`
                            <tr>
                                <td>\${a.storeName}</td>
                                <td>\${a.documentNumber}</td>
                                <td><a href="/reports/\${a.documentNumber}.html" target="_blank" class="report-link">📄 View</a></td>
                                <td>\${new Date(a.auditDate).toLocaleDateString()}</td>
                                <td>\${a.cycle || '-'}</td>
                                <td class="\${a.result === 'Pass' ? 'pass' : 'fail'}">\${a.result}</td>
                                <td class="\${a.score >= 83 ? 'pass' : 'fail'}">\${a.score ? a.score.toFixed(1) : 0}%</td>
                                <td class="nc-count \${a.ncCount > 10 ? 'high' : a.ncCount > 5 ? 'medium' : ''}">\${a.ncCount}</td>
                            </tr>
                        \`).join('') : '<tr><td colspan="8" class="no-data">No audits found</td></tr>'}
                    </tbody>
                </table>
            \`;
            document.getElementById('ncAuditTable').innerHTML = auditsHtml;
            
            // Render Repetitive Findings Table
            let repetitiveHtml = \`
                <div class="nc-summary-stats">
                    <div class="nc-stat">
                        <span class="nc-stat-value">\${summary.totalRepetitiveFindings}</span>
                        <span class="nc-stat-label">Repetitive Findings</span>
                    </div>
                    <div class="nc-stat">
                        <span class="nc-stat-value">\${summary.storesWithRepetitive}</span>
                        <span class="nc-stat-label">Stores Affected</span>
                    </div>
                </div>
                <table class="data-table repetitive-findings-table">
                    <thead>
                        <tr>
                            <th>Store</th>
                            <th>Ref #</th>
                            <th>Section</th>
                            <th>Finding</th>
                            <th>Occurrences</th>
                            <th>Cycles</th>
                            <th>Documents</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${repetitiveFindings.length > 0 ? repetitiveFindings.map(r => \`
                            <tr class="repetitive-row \${r.occurrenceCount >= 3 ? 'critical' : ''}">
                                <td>\${r.storeName}</td>
                                <td class="ref-value">\${r.referenceValue || '-'}</td>
                                <td>\${r.sectionName}</td>
                                <td class="finding-title" title="\${r.title}">\${r.title.length > 60 ? r.title.substring(0, 60) + '...' : r.title}</td>
                                <td class="occurrence-count">
                                    <span class="occurrence-badge \${r.occurrenceCount >= 3 ? 'critical' : 'warning'}">\${r.occurrenceCount}x</span>
                                </td>
                                <td>\${r.cycles}</td>
                                <td class="doc-links">
                                    \${r.documentNumbers.split(', ').map(doc => 
                                        \`<a href="/reports/\${doc}.html" target="_blank" class="doc-link">\${doc}</a>\`
                                    ).join(' ')}
                                </td>
                            </tr>
                        \`).join('') : '<tr><td colspan="7" class="no-data">No repetitive findings found - Good job! 🎉</td></tr>'}
                    </tbody>
                </table>
            \`;
            document.getElementById('repetitiveFindingsTable').innerHTML = repetitiveHtml;
        }

        // =============================================
        // CUSTOM QUERY BUILDER
        // =============================================
        
        let customQueryChart = null;
        let lastQueryResults = null;

        // Update query options based on subject
        function updateQueryOptions() {
            const subject = document.getElementById('querySubject').value;
            const metricSelect = document.getElementById('queryMetric');
            
            // Clear options
            metricSelect.innerHTML = '<option value="">-- Select metric --</option>';
            
            const options = {
                stores: [
                    { value: 'most_fails', text: 'Most Fails' },
                    { value: 'most_audits', text: 'Most Audits' },
                    { value: 'lowest_score', text: 'Lowest Average Score' },
                    { value: 'highest_score', text: 'Highest Average Score' },
                    { value: 'never_pass', text: 'Never Passed (0% pass rate)' },
                    { value: 'always_pass', text: 'Always Passed (100% pass rate)' },
                    { value: 'biggest_drop', text: 'Biggest Score Drop' },
                    { value: 'biggest_improvement', text: 'Biggest Improvement' }
                ],
                auditors: [
                    { value: 'most_audits', text: 'Most Audits Completed' },
                    { value: 'highest_score', text: 'Highest Average Score' },
                    { value: 'lowest_score', text: 'Lowest Average Score' },
                    { value: 'most_fails', text: 'Most Failed Audits' }
                ],
                sections: [
                    { value: 'lowest_score', text: 'Lowest Average Score' },
                    { value: 'highest_score', text: 'Highest Average Score' },
                    { value: 'most_fails', text: 'Highest Fail Rate' },
                    { value: 'most_repetitive', text: 'Most Repetitive Failures' }
                ],
                items: [
                    { value: 'most_repetitive', text: 'Most Repetitive Failures' },
                    { value: 'most_fails', text: 'Most Failed' },
                    { value: 'never_pass', text: 'Never Passed' },
                    { value: 'always_pass', text: 'Always Passed' },
                    { value: 'lowest_score', text: 'Lowest Average Score' }
                ]
            };
            
            if (options[subject]) {
                options[subject].forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.text;
                    metricSelect.appendChild(option);
                });
            }
        }

        // Quick query shortcut
        function quickQuery(subject, metric) {
            document.getElementById('querySubject').value = subject;
            updateQueryOptions();
            document.getElementById('queryMetric').value = metric;
            runCustomQuery();
        }

        // Run custom query
        async function runCustomQuery() {
            const subject = document.getElementById('querySubject').value;
            const metric = document.getElementById('queryMetric').value;
            const limit = document.getElementById('queryLimit').value;
            
            if (!subject || !metric) {
                alert('Please select both a subject and metric');
                return;
            }
            
            showLoading(true);
            
            try {
                const filters = getFilters();
                const params = new URLSearchParams({
                    ...filters,
                    subject,
                    metric,
                    limit: limit === 'all' ? '1000' : limit
                });
                
                const response = await fetch('/api/admin/analytics/custom-query?' + params);
                if (!response.ok) throw new Error('Query failed');
                
                const data = await response.json();
                lastQueryResults = data;
                
                renderQueryResults(data, subject, metric);
                
            } catch (error) {
                console.error('Query error:', error);
                alert('Error running query: ' + error.message);
            } finally {
                showLoading(false);
            }
        }

        // Render query results
        function renderQueryResults(data, subject, metric) {
            const resultsSection = document.getElementById('queryResults');
            const titleEl = document.getElementById('queryResultsTitle');
            const chartContainer = document.getElementById('queryResultsChart');
            const tableContainer = document.getElementById('queryResultsTable');
            
            resultsSection.style.display = 'block';
            
            // Build title
            const subjectNames = { stores: 'Stores', auditors: 'Auditors', sections: 'Sections', items: 'Checklist Items' };
            const metricNames = {
                most_fails: 'Most Fails',
                most_audits: 'Most Audits',
                lowest_score: 'Lowest Score',
                highest_score: 'Highest Score',
                most_repetitive: 'Most Repetitive',
                never_pass: 'Never Passed',
                always_pass: 'Always Passed',
                biggest_drop: 'Biggest Drop',
                biggest_improvement: 'Biggest Improvement'
            };
            
            titleEl.textContent = \`\${subjectNames[subject]} - \${metricNames[metric]} (\${data.results.length} results)\`;
            
            // Render chart
            if (customQueryChart) customQueryChart.destroy();
            
            const ctx = document.getElementById('customQueryChart').getContext('2d');
            const labels = data.results.map(r => r.name.length > 30 ? r.name.substring(0, 30) + '...' : r.name);
            const values = data.results.map(r => r.value);
            
            const colors = values.map(v => {
                if (metric.includes('fail') || metric === 'lowest_score' || metric === 'never_pass' || metric === 'biggest_drop') {
                    return 'rgba(239, 68, 68, 0.7)'; // Red for bad things
                }
                return 'rgba(16, 185, 129, 0.7)'; // Green for good things
            });
            
            customQueryChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: data.valueLabel || 'Value',
                        data: values,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: data.results.length > 10 ? 'y' : 'x',
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { beginAtZero: true },
                        y: { beginAtZero: true }
                    }
                }
            });
            
            // Render table
            let tableHtml = \`
                <table class="data-table query-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>\${subjectNames[subject]}</th>
                            <th>\${data.valueLabel || 'Value'}</th>
                            \${data.results[0]?.extra ? '<th>Details</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
            \`;
            
            data.results.forEach((r, i) => {
                const valueClass = (metric.includes('fail') || metric === 'lowest_score' || metric === 'never_pass') ? 'fail' : 
                                   (metric.includes('pass') || metric === 'highest_score' || metric === 'improvement') ? 'pass' : '';
                tableHtml += \`
                    <tr>
                        <td>\${i + 1}</td>
                        <td>\${r.name}</td>
                        <td class="\${valueClass}">\${typeof r.value === 'number' ? r.value.toFixed(1) : r.value}\${r.suffix || ''}</td>
                        \${r.extra ? \`<td>\${r.extra}</td>\` : ''}
                    </tr>
                \`;
            });
            
            tableHtml += '</tbody></table>';
            tableContainer.innerHTML = tableHtml;
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }

        // Export query results
        function exportQueryResults() {
            if (!lastQueryResults) return;
            
            let csv = 'Name,Value,Details\\n';
            lastQueryResults.results.forEach(r => {
                csv += \`"\${r.name}",\${r.value},"\${r.extra || ''}"\\n\`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analytics-query-results.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>
        `;

        res.send(html);
    }
}

module.exports = AnalyticsPage;
