/**
 * Question Editor
 * Handles the add/edit question modal
 */

class QuestionEditor {
    constructor() {
        this.modal = document.getElementById('questionModal');
        this.form = document.getElementById('questionForm');
        this.isEditMode = false;
        this.currentSection = null;
        this.currentQuestionId = null;
        
        this.init();
    }

    /**
     * Initialize editor
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

        // Section change - update suggested reference
        document.getElementById('questionSection').addEventListener('change', async (e) => {
            if (e.target.value) {
                await this.updateSuggestedReference(e.target.value);
            }
        });

        // Form submit
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveQuestion();
        });
    }

    /**
     * Open modal for adding or editing
     * @param {string} section - Section name (for edit mode)
     * @param {number} questionId - Question ID (for edit mode)
     */
    async openModal(section = null, questionId = null) {
        this.isEditMode = !!(section && questionId);
        this.currentSection = section;
        this.currentQuestionId = questionId;

        // Update modal title
        document.getElementById('modalTitle').textContent = 
            this.isEditMode ? 'Edit Question' : 'Add Question';

        if (this.isEditMode) {
            // Load question data
            await this.loadQuestion(section, questionId);
        } else {
            // Reset form
            this.form.reset();
            document.getElementById('questionId').value = '';
            document.getElementById('originalSection').value = '';
            document.getElementById('suggestedReference').textContent = '-';
        }

        // Show modal
        this.modal.style.display = 'flex';
    }

    /**
     * Close modal
     */
    closeModal() {
        this.modal.style.display = 'none';
        this.form.reset();
        this.isEditMode = false;
        this.currentSection = null;
        this.currentQuestionId = null;
    }

    /**
     * Load question data for editing
     */
    async loadQuestion(section, questionId) {
        try {
            const response = await fetch(
                `/api/checklist/sections/${encodeURIComponent(section)}/questions/${questionId}`
            );
            const data = await response.json();
            const question = data.question;

            // Populate form
            document.getElementById('questionId').value = question.id;
            document.getElementById('originalSection').value = section;
            document.getElementById('questionSection').value = section;
            document.getElementById('questionReference').value = question.ReferenceValue || '';
            document.getElementById('questionTitle').value = question.Title || '';
            document.getElementById('questionCr').value = question.cr || '';
            document.getElementById('questionCoeff').value = question.Coeff || 2;
            document.getElementById('questionAnswer').value = question.Answer || 'Yes,Partially,No,NA';

            // Update suggested reference
            await this.updateSuggestedReference(section);

        } catch (error) {
            console.error('Error loading question:', error);
            alert('❌ Failed to load question data');
            this.closeModal();
        }
    }

    /**
     * Update suggested reference value
     */
    async updateSuggestedReference(section) {
        try {
            const response = await fetch(
                `/api/checklist/sections/${encodeURIComponent(section)}/next-reference`
            );
            const data = await response.json();
            document.getElementById('suggestedReference').textContent = data.nextReference;
        } catch (error) {
            console.error('Error getting next reference:', error);
            document.getElementById('suggestedReference').textContent = '-';
        }
    }

    /**
     * Save question (add or update)
     */
    async saveQuestion() {
        try {
            // Validate form
            if (!this.form.checkValidity()) {
                this.form.reportValidity();
                return;
            }

            // Collect form data
            const questionData = {
                Title: document.getElementById('questionTitle').value.trim(),
                Coeff: parseInt(document.getElementById('questionCoeff').value),
                Answer: document.getElementById('questionAnswer').value,
                cr: document.getElementById('questionCr').value.trim(),
                ReferenceValue: document.getElementById('questionReference').value.trim(),
                reason: document.getElementById('questionReason').value.trim()
            };

            const section = document.getElementById('questionSection').value;

            let response;
            if (this.isEditMode) {
                // Update existing question
                const questionId = document.getElementById('questionId').value;
                response = await fetch(
                    `/api/checklist/sections/${encodeURIComponent(section)}/questions/${questionId}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(questionData)
                    }
                );
            } else {
                // Add new question
                response = await fetch(
                    `/api/checklist/sections/${encodeURIComponent(section)}/questions`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(questionData)
                    }
                );
            }

            const data = await response.json();

            if (data.success) {
                alert(`✅ Question ${this.isEditMode ? 'updated' : 'added'} successfully`);
                this.closeModal();
                
                // Refresh table
                if (window.checklistManager) {
                    await window.checklistManager.refresh();
                }
            } else {
                throw new Error(data.error || 'Save failed');
            }

        } catch (error) {
            console.error('Save error:', error);
            alert(`❌ Failed to save question: ${error.message}`);
        }
    }

    /**
     * Validate reference value format
     */
    validateReferenceValue(value) {
        if (!value) return true; // Optional field
        return /^\d+\.\d+$/.test(value);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.questionEditor = new QuestionEditor();
});
