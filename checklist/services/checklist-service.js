/**
 * Checklist Service
 * CRUD operations for managing checklist questions in SharePoint master lists
 * 
 * Works with 13 master sections in SharePoint
 */

const SimpleGraphConnector = require('../../src/simple-graph-connector');

class ChecklistService {
    constructor() {
        this.connector = new SimpleGraphConnector();
        
        // 13 Master sections mapping
        this.sections = {
            'Food Storage & Dry Storage': 'Food Storage & Dry Storage',
            'Fridges and Freezers': 'Fridges and Freezers',
            'Utensils and Equipment': 'Utensils and Equipment',
            'Food Handling': 'Food Handling',
            'Cleaning and Disinfection': 'Cleaning and Disinfection',
            'Personal Hygiene': 'Personal Hygiene',
            'Restrooms': 'Restrooms',
            'Garbage Storage & Disposal': 'Garbage Storage & Disposal',
            'Maintenance': 'Maintenance',
            'Chemicals Available': 'Chemicals Available',
            'Monitoring Sheets': 'Monitoring Sheets',
            'Food Safety Culture': 'Food Safety Culture',
            'Policies & Procedures': 'Policies & Procedures'
        };
    }

    /**
     * Get all section names
     * @returns {Array} Array of section names
     */
    getAllSections() {
        return Object.keys(this.sections);
    }

    /**
     * Get all questions from a specific section
     * @param {string} sectionName - Name of the section
     * @returns {Promise<Array>} Array of questions
     */
    async getSectionQuestions(sectionName) {
        try {
            if (!this.sections[sectionName]) {
                throw new Error(`Section '${sectionName}' not found`);
            }

            const listName = this.sections[sectionName];
            const items = await this.connector.getListItems(listName);

            // Map SharePoint fields to our question structure
            return items.map(item => ({
                id: item.Id || item.ID,
                Title: item.Title || '',
                Coeff: item.Coeff || 0,
                Answer: item.Answer || 'Yes,No',
                cr: item.cr || '',
                ReferenceValue: item.ReferenceValue || '',
                IsActive: item.IsActive !== false, // Default to true
                section: sectionName
            }));

        } catch (error) {
            console.error(`❌ Error fetching questions from ${sectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get a single question by ID
     * @param {string} sectionName - Section name
     * @param {number} questionId - Question ID
     * @returns {Promise<Object>} Question object
     */
    async getQuestionById(sectionName, questionId) {
        try {
            const questions = await this.getSectionQuestions(sectionName);
            const question = questions.find(q => q.id === parseInt(questionId));
            
            if (!question) {
                throw new Error(`Question ${questionId} not found in ${sectionName}`);
            }
            
            return question;
        } catch (error) {
            console.error(`❌ Error fetching question ${questionId}:`, error);
            throw error;
        }
    }

    /**
     * Add a new question to a section
     * @param {string} sectionName - Section name
     * @param {Object} questionData - Question data
     * @returns {Promise<Object>} Created question
     */
    async addQuestion(sectionName, questionData) {
        try {
            if (!this.sections[sectionName]) {
                throw new Error(`Section '${sectionName}' not found`);
            }

            // Validate required fields
            this.validateQuestion(questionData);

            const listName = this.sections[sectionName];
            
            // Prepare SharePoint item
            const item = {
                Title: questionData.Title,
                Coeff: questionData.Coeff,
                Answer: questionData.Answer || 'Yes,Partially,No,NA',
                cr: questionData.cr || '',
                ReferenceValue: questionData.ReferenceValue || '',
                IsActive: questionData.IsActive !== false
            };

            // Add to SharePoint
            const result = await this.connector.addListItem(listName, item);
            
            console.log(`✅ Question added to ${sectionName}:`, result.id);
            
            return {
                id: result.id,
                ...item,
                section: sectionName
            };

        } catch (error) {
            console.error(`❌ Error adding question to ${sectionName}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing question
     * @param {string} sectionName - Section name
     * @param {number} questionId - Question ID
     * @param {Object} questionData - Updated question data
     * @returns {Promise<Object>} Updated question
     */
    async updateQuestion(sectionName, questionId, questionData) {
        try {
            if (!this.sections[sectionName]) {
                throw new Error(`Section '${sectionName}' not found`);
            }

            // Get existing question first
            const existingQuestion = await this.getQuestionById(sectionName, questionId);
            
            const listName = this.sections[sectionName];
            
            // Prepare update data
            const updates = {};
            if (questionData.Title !== undefined) updates.Title = questionData.Title;
            if (questionData.Coeff !== undefined) updates.Coeff = questionData.Coeff;
            if (questionData.Answer !== undefined) updates.Answer = questionData.Answer;
            if (questionData.cr !== undefined) updates.cr = questionData.cr;
            if (questionData.ReferenceValue !== undefined) updates.ReferenceValue = questionData.ReferenceValue;
            if (questionData.IsActive !== undefined) updates.IsActive = questionData.IsActive;

            // Update in SharePoint
            await this.connector.updateListItem(listName, questionId, updates);
            
            console.log(`✅ Question ${questionId} updated in ${sectionName}`);
            
            return {
                id: questionId,
                ...existingQuestion,
                ...updates,
                section: sectionName
            };

        } catch (error) {
            console.error(`❌ Error updating question ${questionId}:`, error);
            throw error;
        }
    }

    /**
     * Toggle question active status
     * @param {string} sectionName - Section name
     * @param {number} questionId - Question ID
     * @param {boolean} isActive - New active status
     * @returns {Promise<Object>} Updated question
     */
    async toggleQuestionStatus(sectionName, questionId, isActive) {
        try {
            return await this.updateQuestion(sectionName, questionId, { IsActive: isActive });
        } catch (error) {
            console.error(`❌ Error toggling question status:`, error);
            throw error;
        }
    }

    /**
     * Delete a question (soft delete - deactivate)
     * @param {string} sectionName - Section name
     * @param {number} questionId - Question ID
     * @returns {Promise<Object>} Deactivated question
     */
    async deleteQuestion(sectionName, questionId) {
        try {
            // Soft delete by deactivating
            return await this.toggleQuestionStatus(sectionName, questionId, false);
        } catch (error) {
            console.error(`❌ Error deleting question:`, error);
            throw error;
        }
    }

    /**
     * Search questions across all sections
     * @param {string} searchTerm - Search term
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Matching questions
     */
    async searchQuestions(searchTerm, filters = {}) {
        try {
            const allQuestions = [];
            const sectionsToSearch = filters.section 
                ? [filters.section] 
                : this.getAllSections();

            // Search across specified sections
            for (const section of sectionsToSearch) {
                try {
                    const questions = await this.getSectionQuestions(section);
                    allQuestions.push(...questions);
                } catch (error) {
                    console.warn(`⚠️ Could not fetch ${section}:`, error.message);
                }
            }

            // Filter by search term
            let results = allQuestions;
            
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                results = results.filter(q => 
                    (q.Title && q.Title.toLowerCase().includes(term)) ||
                    (q.cr && q.cr.toLowerCase().includes(term)) ||
                    (q.ReferenceValue && q.ReferenceValue.toLowerCase().includes(term))
                );
            }

            // Apply additional filters
            if (filters.isActive !== undefined) {
                results = results.filter(q => q.IsActive === filters.isActive);
            }

            if (filters.coeff !== undefined) {
                results = results.filter(q => q.Coeff === parseInt(filters.coeff));
            }

            return results;

        } catch (error) {
            console.error(`❌ Error searching questions:`, error);
            throw error;
        }
    }

    /**
     * Get statistics for all sections
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const stats = {
                totalQuestions: 0,
                activeQuestions: 0,
                inactiveQuestions: 0,
                sections: []
            };

            for (const section of this.getAllSections()) {
                try {
                    const questions = await this.getSectionQuestions(section);
                    const active = questions.filter(q => q.IsActive).length;
                    const inactive = questions.filter(q => !q.IsActive).length;

                    stats.totalQuestions += questions.length;
                    stats.activeQuestions += active;
                    stats.inactiveQuestions += inactive;

                    stats.sections.push({
                        name: section,
                        total: questions.length,
                        active: active,
                        inactive: inactive
                    });
                } catch (error) {
                    console.warn(`⚠️ Could not fetch stats for ${section}`);
                }
            }

            return stats;

        } catch (error) {
            console.error(`❌ Error getting statistics:`, error);
            throw error;
        }
    }

    /**
     * Validate question data
     * @param {Object} questionData - Question data to validate
     * @throws {Error} If validation fails
     */
    validateQuestion(questionData) {
        if (!questionData.Title || questionData.Title.trim() === '') {
            throw new Error('Question Title is required');
        }

        if (!questionData.Coeff || ![2, 4].includes(parseInt(questionData.Coeff))) {
            throw new Error('Coefficient must be 2 or 4');
        }

        if (!questionData.Answer) {
            throw new Error('Answer options are required');
        }

        // Validate answer options format
        const answers = questionData.Answer.split(',').map(a => a.trim());
        if (!answers.includes('Yes') || !answers.includes('No')) {
            throw new Error('Answer options must include at least "Yes" and "No"');
        }
    }

    /**
     * Get next suggested reference value for a section
     * @param {string} sectionName - Section name
     * @returns {Promise<string>} Suggested reference value
     */
    async getNextReferenceValue(sectionName) {
        try {
            const questions = await this.getSectionQuestions(sectionName);
            
            if (questions.length === 0) {
                return '1.1';
            }

            // Extract numeric reference values
            const refValues = questions
                .map(q => q.ReferenceValue)
                .filter(ref => ref && /^\d+\.\d+$/.test(ref))
                .map(ref => parseFloat(ref))
                .sort((a, b) => b - a);

            if (refValues.length === 0) {
                return '1.1';
            }

            // Get highest value and increment
            const highest = refValues[0];
            const nextValue = (Math.floor(highest) + (Math.floor((highest % 1) * 10 + 1) / 10));
            
            return nextValue.toFixed(1);

        } catch (error) {
            console.error(`❌ Error getting next reference value:`, error);
            return '1.1';
        }
    }
}

module.exports = ChecklistService;
