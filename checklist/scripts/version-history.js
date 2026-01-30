/**
 * Version History Viewer
 * Displays change history for questions
 */

class VersionHistory {
    constructor() {
        this.modal = document.getElementById('historyModal');
        this.content = document.getElementById('historyContent');
        this.currentSection = null;
        this.currentQuestionId = null;
        
        this.init();
    }

    /**
     * Initialize viewer
     */
    init() {
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close modal buttons
        this.modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }

    /**
     * Open modal with history
     * @param {string} section - Section name (optional, for specific question)
     * @param {number} questionId - Question ID (optional, for specific question)
     */
    async openModal(section = null, questionId = null) {
        this.currentSection = section;
        this.currentQuestionId = questionId;

        // Show modal
        this.modal.style.display = 'flex';

        // Load history
        if (section && questionId) {
            await this.loadQuestionHistory(section, questionId);
        } else {
            await this.loadRecentHistory();
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        this.modal.style.display = 'none';
        this.content.innerHTML = '';
        this.currentSection = null;
        this.currentQuestionId = null;
    }

    /**
     * Load history for specific question
     */
    async loadQuestionHistory(section, questionId) {
        try {
            this.content.innerHTML = '<p>Loading history...</p>';

            const response = await fetch(
                `/api/checklist/history/${encodeURIComponent(section)}/${questionId}`
            );
            const data = await response.json();

            if (data.history.length === 0) {
                this.content.innerHTML = '<p class="empty-message">No change history available for this question.</p>';
                return;
            }

            this.renderHistory(data.history, `${section} - Question ${questionId}`);

        } catch (error) {
            console.error('Error loading question history:', error);
            this.content.innerHTML = '<p class="error-message">❌ Failed to load history</p>';
        }
    }

    /**
     * Load recent changes across all questions
     */
    async loadRecentHistory() {
        try {
            this.content.innerHTML = '<p>Loading recent changes...</p>';

            const response = await fetch('/api/checklist/history/recent?hours=168'); // Last 7 days
            const data = await response.json();

            if (data.changes.length === 0) {
                this.content.innerHTML = '<p class="empty-message">No recent changes in the last 7 days.</p>';
                return;
            }

            this.renderHistory(data.changes, 'Recent Changes (Last 7 Days)');

        } catch (error) {
            console.error('Error loading recent history:', error);
            this.content.innerHTML = '<p class="error-message">❌ Failed to load history</p>';
        }
    }

    /**
     * Render history table
     */
    renderHistory(history, title) {
        const html = `
            <div class="history-header">
                <h3>${title}</h3>
                <p class="history-count">${history.length} change${history.length !== 1 ? 's' : ''} found</p>
            </div>
            
            <div class="history-table-container">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Section</th>
                            <th>Question ID</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(entry => this.renderHistoryRow(entry)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.content.innerHTML = html;

        // Attach detail toggle listeners
        this.attachDetailToggles();
    }

    /**
     * Render single history row
     */
    renderHistoryRow(entry) {
        const date = new Date(entry.created_at);
        const formattedDate = date.toLocaleString();
        const action = entry.action.replace('CHECKLIST_', '');
        const actionClass = this.getActionClass(action);
        
        const details = entry.details || {};
        const hasChanges = details.questionData || details.beforeState;

        return `
            <tr class="history-row">
                <td class="date-cell">${formattedDate}</td>
                <td class="user-cell">
                    <div class="user-info-cell">
                        <div>${entry.user_email || 'Unknown'}</div>
                        <small>ID: ${entry.user_id || '-'}</small>
                    </div>
                </td>
                <td class="action-cell">
                    <span class="badge badge-${actionClass}">${action}</span>
                </td>
                <td class="section-cell">${this.truncate(entry.section, 30)}</td>
                <td class="center">${entry.question_id || '-'}</td>
                <td class="details-cell">
                    ${hasChanges ? `
                        <button class="btn-details" data-entry-id="${entry.id}">
                            View Changes
                        </button>
                    ` : '-'}
                    ${entry.reason ? `
                        <div class="reason-text" title="${this.escapeHtml(entry.reason)}">
                            💬 ${this.truncate(entry.reason, 40)}
                        </div>
                    ` : ''}
                </td>
            </tr>
            <tr class="details-row" id="details-${entry.id}" style="display: none;">
                <td colspan="6">
                    <div class="details-content">
                        ${this.renderChanges(details)}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Render change details
     */
    renderChanges(details) {
        if (!details.beforeState && !details.questionData) {
            return '<p>No detailed changes available.</p>';
        }

        const before = details.beforeState || {};
        const after = details.questionData || {};

        // Calculate differences
        const allKeys = new Set([
            ...Object.keys(before),
            ...Object.keys(after)
        ]);

        const changes = [];
        allKeys.forEach(key => {
            if (key === 'id' || key === 'section') return; // Skip meta fields
            
            const beforeVal = before[key];
            const afterVal = after[key];

            if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                changes.push({
                    field: key,
                    before: beforeVal,
                    after: afterVal
                });
            }
        });

        if (changes.length === 0) {
            return '<p>No field changes detected.</p>';
        }

        return `
            <table class="changes-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Before</th>
                        <th>After</th>
                    </tr>
                </thead>
                <tbody>
                    ${changes.map(change => `
                        <tr>
                            <td class="field-name">${change.field}</td>
                            <td class="before-value">${this.formatValue(change.before)}</td>
                            <td class="after-value">${this.formatValue(change.after)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Attach detail toggle listeners
     */
    attachDetailToggles() {
        document.querySelectorAll('.btn-details').forEach(btn => {
            btn.addEventListener('click', () => {
                const entryId = btn.dataset.entryId;
                const detailsRow = document.getElementById(`details-${entryId}`);
                
                if (detailsRow.style.display === 'none') {
                    detailsRow.style.display = 'table-row';
                    btn.textContent = 'Hide Changes';
                } else {
                    detailsRow.style.display = 'none';
                    btn.textContent = 'View Changes';
                }
            });
        });
    }

    /**
     * Get CSS class for action badge
     */
    getActionClass(action) {
        const map = {
            'ADD': 'success',
            'UPDATE': 'info',
            'DELETE': 'danger',
            'TOGGLE': 'warning'
        };
        return map[action] || 'default';
    }

    /**
     * Format value for display
     */
    formatValue(value) {
        if (value === null || value === undefined) {
            return '<em class="null-value">null</em>';
        }
        if (value === '') {
            return '<em class="empty-value">(empty)</em>';
        }
        if (typeof value === 'boolean') {
            return value ? '✅ true' : '❌ false';
        }
        if (typeof value === 'object') {
            return `<code>${JSON.stringify(value, null, 2)}</code>`;
        }
        return this.escapeHtml(String(value));
    }

    /**
     * Utility: Truncate text
     */
    truncate(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.versionHistory = new VersionHistory();
});
