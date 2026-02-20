/**
 * Admin Analytics Page Module
 * Advanced Analytics Dashboard with charts and visualizations
 * 
 * Features:
 * 1. Trend Charts - Score trends over time by store/auditor
 * 2. Auditor Performance - Compare auditors by # audits, avg scores
 * 3. Section Weakness Report - Which sections fail most often
 * 4. Heatmap - Visual grid of stores vs sections showing problem areas
 * 5. Compliance Calendar - See when stores were last audited
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
                    <p>Active Stores</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="card-icon">👥</div>
                <div class="card-content">
                    <h3 id="totalAuditors">-</h3>
                    <p>Active Auditors</p>
                </div>
            </div>
            <div class="summary-card pass">
                <div class="card-icon">✅</div>
                <div class="card-content">
                    <h3 id="passRate">-</h3>
                    <p>Pass Rate</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="card-icon">📈</div>
                <div class="card-content">
                    <h3 id="avgScore">-</h3>
                    <p>Avg Score</p>
                </div>
            </div>
            <div class="summary-card clickable" onclick="showUnsolvedActionPlans()" title="Click to view unsolved items">
                <div class="card-icon">📝</div>
                <div class="card-content">
                    <h3 id="actionPlanCompletion">-</h3>
                    <p>Action Plans Solved</p>
                    <span class="click-hint">Click to view unsolved ➡️</span>
                </div>
            </div>
        </section>

        <!-- Filter Section -->
        <section class="filter-section">
            <div class="filter-group">
                <label for="yearFilter">Year:</label>
                <select id="yearFilter" onchange="refreshAnalytics()">
                    <option value="">All Years</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="cycleFilter">Cycle:</label>
                <select id="cycleFilter" onchange="refreshAnalytics()">
                    <option value="">All Cycles</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                    <option value="C3">C3</option>
                    <option value="C4">C4</option>
                    <option value="C5">C5</option>
                    <option value="C6">C6</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="storeFilter">Store:</label>
                <select id="storeFilter" onchange="refreshAnalytics()">
                    <option value="">All Stores</option>
                </select>
            </div>
            <button class="btn-refresh" onclick="refreshAnalytics()">🔄 Refresh</button>
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

            <!-- Section Weakness -->
            <section class="chart-card">
                <h2>⚠️ Section Weakness Report</h2>
                <div class="chart-container">
                    <canvas id="sectionChart"></canvas>
                </div>
                <div id="sectionTable" class="data-table-container"></div>
            </section>

            <!-- Heatmap -->
            <section class="chart-card full-width">
                <h2>🗺️ Store vs Section Heatmap</h2>
                <div class="heatmap-container" id="heatmapContainer">
                    <p class="loading-text">Loading heatmap...</p>
                </div>
            </section>

            <!-- Compliance Calendar -->
            <section class="chart-card full-width">
                <h2>📅 Compliance Calendar - Last Audit Dates</h2>
                <div id="calendarContainer" class="calendar-container">
                    <p class="loading-text">Loading calendar...</p>
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

        // Initialize filter dropdowns
        async function initFilters() {
            try {
                // Load years
                const currentYear = new Date().getFullYear();
                const yearSelect = document.getElementById('yearFilter');
                for (let y = currentYear; y >= currentYear - 5; y--) {
                    const option = document.createElement('option');
                    option.value = y;
                    option.textContent = y;
                    yearSelect.appendChild(option);
                }

                // Load stores
                const storesResponse = await fetch('/api/admin/stores');
                if (storesResponse.ok) {
                    const stores = await storesResponse.json();
                    const storeSelect = document.getElementById('storeFilter');
                    stores.forEach(store => {
                        const option = document.createElement('option');
                        option.value = store.storeId || store.StoreID;
                        option.textContent = store.storeName || store.StoreName;
                        storeSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error initializing filters:', error);
            }
        }

        // Get current filter values
        function getFilters() {
            return {
                year: document.getElementById('yearFilter').value,
                cycle: document.getElementById('cycleFilter').value,
                storeId: document.getElementById('storeFilter').value
            };
        }

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
                renderSectionWeakness(analyticsData.sectionWeakness);
                renderHeatmap(analyticsData.heatmap);
                renderComplianceCalendar(analyticsData.complianceCalendar);
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
            document.getElementById('totalAudits').textContent = summary.totalAudits || 0;
            document.getElementById('totalStores').textContent = summary.totalStores || 0;
            document.getElementById('totalAuditors').textContent = summary.totalAuditors || 0;
            document.getElementById('passRate').textContent = (summary.passRate || 0).toFixed(1) + '%';
            document.getElementById('avgScore').textContent = (summary.avgScore || 0).toFixed(1) + '%';
            
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

        // Render section weakness report
        function renderSectionWeakness(sections) {
            const ctx = document.getElementById('sectionChart').getContext('2d');
            
            if (sectionChart) sectionChart.destroy();

            // Sort by average score (weakest first)
            const sorted = [...sections].sort((a, b) => a.avgScore - b.avgScore);
            
            const labels = sorted.map(s => s.sectionName);
            const scores = sorted.map(s => s.avgScore);
            const failRates = sorted.map(s => s.failRate);

            const colors = scores.map(s => {
                if (s >= 83) return '#10b981';
                if (s >= 70) return '#f59e0b';
                return '#ef4444';
            });

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
                                        'Fail Rate: ' + section.failRate.toFixed(1) + '%',
                                        'Times Audited: ' + section.timesAudited
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
                            <th>Section</th>
                            <th>Avg Score</th>
                            <th>Fail Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${sorted.map(s => \`
                            <tr>
                                <td>\${s.sectionName}</td>
                                <td class="\${s.avgScore >= 83 ? 'pass' : 'fail'}">\${s.avgScore.toFixed(1)}%</td>
                                <td class="\${s.failRate > 20 ? 'fail' : ''}">\${s.failRate.toFixed(1)}%</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('sectionTable').innerHTML = tableHtml;
        }

        // Render heatmap
        function renderHeatmap(heatmapData) {
            const container = document.getElementById('heatmapContainer');
            
            if (!heatmapData || !heatmapData.stores || heatmapData.stores.length === 0) {
                container.innerHTML = '<p class="no-data">No heatmap data available</p>';
                return;
            }

            const { stores, sections, data } = heatmapData;

            // Create heatmap table
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
