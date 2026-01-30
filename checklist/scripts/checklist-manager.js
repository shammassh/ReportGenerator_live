/**
 * Checklist Manager
 * Main frontend logic for checklist management interface
 */

class ChecklistManager {
    constructor() {
        this.currentSection = '';
        this.currentStatus = '';
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.allQuestions = [];
        this.filteredQuestions = [];
        
        this.init();
    }

    /**
     * Initialize the manager
     */
    init() {
        this.attachEventListeners();
        this.loadAllQuestions();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Filter controls
        document.getElementById('sectionFilter').addEventListener('change', (e) => {
            this.currentSection = e.target.value;
            this.applyFilters();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.currentStatus = e.target.value;
            this.applyFilters();
        });

        // Search
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Add question button
        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            window.questionEditor.openModal();
        });

        // View history button
        document.getElementById('viewHistoryBtn').addEventListener('click', () => {
            window.versionHistory.openModal();
        });
    }

    /**
     * Load all questions from all sections
     */
    async loadAllQuestions() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/checklist/sections');
            const data = await response.json();
            const sections = data.sections;

            this.allQuestions = [];

            // Load questions from each section
            for (const section of sections) {
                try {
                    const res = await fetch(`/api/checklist/sections/${encodeURIComponent(section)}/questions`);
                    const sectionData = await res.json();
                    this.allQuestions.push(...sectionData.questions);
                } catch (error) {
                    console.error(`Error loading ${section}:`, error);
                }
            }

            this.applyFilters();
        } catch (error) {
            console.error('Error loading questions:', error);
            this.showError('Failed to load questions');
        }
    }

    /**
     * Apply current filters
     */
    applyFilters() {
        this.filteredQuestions = this.allQuestions.filter(q => {
            // Section filter
            if (this.currentSection && q.section !== this.currentSection) {
                return false;
            }

            // Status filter
            if (this.currentStatus === 'active' && !q.IsActive) {
                return false;
            }
            if (this.currentStatus === 'inactive' && q.IsActive) {
                return false;
            }

            return true;
        });

        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
    }

    /**
     * Perform search
     */
    async performSearch() {
        const searchTerm = document.getElementById('searchInput').value.trim();
        
        if (!searchTerm) {
            this.loadAllQuestions();
            return;
        }

        try {
            this.showLoading();

            const params = new URLSearchParams({ q: searchTerm });
            if (this.currentSection) params.append('section', this.currentSection);
            if (this.currentStatus) params.append('isActive', this.currentStatus === 'active');

            const response = await fetch(`/api/checklist/search?${params}`);
            const data = await response.json();

            this.allQuestions = data.questions;
            this.applyFilters();
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed');
        }
    }

    /**
     * Render questions table
     */
    renderTable() {
        const tbody = document.getElementById('questionsTableBody');
        
        if (this.filteredQuestions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No questions found</td></tr>';
            return;
        }

        // Calculate pagination
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        const pageQuestions = this.filteredQuestions.slice(startIdx, endIdx);

        // Render rows
        tbody.innerHTML = pageQuestions.map(q => this.renderQuestionRow(q)).join('');

        // Attach action listeners
        this.attachRowActions();
    }

    /**
     * Render a single question row
     */
    renderQuestionRow(question) {
        const statusClass = question.IsActive ? 'badge-active' : 'badge-inactive';
        const statusText = question.IsActive ? 'Active' : 'Inactive';
        
        return `
            <tr data-question-id="${question.id}" data-section="${question.section}">
                <td>${question.ReferenceValue || '-'}</td>
                <td><span class="section-label">${this.truncate(question.section, 25)}</span></td>
                <td class="question-cell">${this.escapeHtml(question.Title)}</td>
                <td class="center">${question.Coeff}</td>
                <td class="center">${this.formatAnswers(question.Answer)}</td>
                <td class="center"><span class="badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" title="Edit">✏️</button>
                    <button class="btn-icon btn-toggle" title="${question.IsActive ? 'Deactivate' : 'Activate'}">
                        ${question.IsActive ? '🔴' : '🟢'}
                    </button>
                    <button class="btn-icon btn-history" title="History">📜</button>
                </td>
            </tr>
        `;
    }

    /**
     * Attach row action listeners
     */
    attachRowActions() {
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const section = row.dataset.section;
                const id = row.dataset.questionId;
                window.questionEditor.openModal(section, id);
            });
        });

        // Toggle buttons
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.target.closest('tr');
                const section = row.dataset.section;
                const id = row.dataset.questionId;
                await this.toggleQuestion(section, id);
            });
        });

        // History buttons
        document.querySelectorAll('.btn-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const section = row.dataset.section;
                const id = row.dataset.questionId;
                window.versionHistory.openModal(section, id);
            });
        });
    }

    /**
     * Toggle question active status
     */
    async toggleQuestion(section, id) {
        const question = this.allQuestions.find(q => q.id == id && q.section === section);
        if (!question) return;

        const action = question.IsActive ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this question?`)) {
            return;
        }

        try {
            const response = await fetch(
                `/api/checklist/sections/${encodeURIComponent(section)}/questions/${id}/toggle`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: !question.IsActive })
                }
            );

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Question ${action}d successfully`);
                await this.loadAllQuestions();
            } else {
                throw new Error(data.error || 'Toggle failed');
            }
        } catch (error) {
            console.error('Toggle error:', error);
            this.showError(`Failed to ${action} question`);
        }
    }

    /**
     * Render pagination
     */
    renderPagination() {
        const totalPages = Math.ceil(this.filteredQuestions.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        const buttons = [];

        // Previous button
        buttons.push(`
            <button class="btn-page ${this.currentPage === 1 ? 'disabled' : ''}" 
                    data-page="${this.currentPage - 1}" 
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                ← Previous
            </button>
        `);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                buttons.push(`
                    <button class="btn-page ${i === this.currentPage ? 'active' : ''}" 
                            data-page="${i}">
                        ${i}
                    </button>
                `);
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                buttons.push('<span class="pagination-ellipsis">...</span>');
            }
        }

        // Next button
        buttons.push(`
            <button class="btn-page ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    data-page="${this.currentPage + 1}" 
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                Next →
            </button>
        `);

        pagination.innerHTML = buttons.join('');

        // Attach page button listeners
        pagination.querySelectorAll('.btn-page:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderTable();
                this.renderPagination();
            });
        });
    }

    /**
     * Utility: Show loading state
     */
    showLoading() {
        const tbody = document.getElementById('questionsTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading...</td></tr>';
    }

    /**
     * Utility: Show error message
     */
    showError(message) {
        alert(`❌ ${message}`);
    }

    /**
     * Utility: Show success message
     */
    showSuccess(message) {
        alert(`✅ ${message}`);
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

    /**
     * Utility: Format answer options
     */
    formatAnswers(answers) {
        if (!answers) return '-';
        const opts = answers.split(',').map(a => a.trim());
        return `<small>${opts.join(', ')}</small>`;
    }

    /**
     * Refresh data
     */
    async refresh() {
        await this.loadAllQuestions();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.checklistManager = new ChecklistManager();
});
