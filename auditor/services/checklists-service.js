/**
 * Checklists Service
 * Fetches available checklists from SharePoint
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const { SimpleGraphConnector } = require('../../src/simple-graph-connector');

class ChecklistsService {
    constructor() {
        this.graphConnector = null;
        this.cachedChecklists = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    }
    
    /**
     * Initialize Graph connector
     */
    async initialize() {
        if (!this.graphConnector) {
            this.graphConnector = new SimpleGraphConnector();
            await this.graphConnector.initialize();
        }
    }
    
    /**
     * Get list of available checklists
     * Based on the section master lists from the copilot instructions
     */
    async getChecklistsList() {
        try {
            // Check cache
            if (this.cachedChecklists && this.cacheTimestamp && 
                (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
                console.log('[CHECKLISTS] Returning cached checklists');
                return this.cachedChecklists;
            }
            
            await this.initialize();
            
            console.log('[CHECKLISTS] Building checklist information...');
            
            // Define the checklists based on the section master lists
            // These are the 13 sections defined in the copilot instructions
            const checklists = [
                {
                    id: 'fs-survey-complete',
                    name: 'Complete Food Safety Survey',
                    type: 'Full Audit',
                    sections: 13,
                    questionCount: await this.getTotalQuestionCount(),
                    duration: '90-120 min',
                    description: 'Complete audit covering all 13 food safety sections',
                    masterLists: this.getAllMasterLists()
                },
                {
                    id: 'food-storage',
                    name: 'Food Storage & Dry Storage',
                    type: 'Section Audit',
                    sections: 1,
                    questionCount: await this.getListItemCount('Food Storage & Dry Storage'),
                    duration: '15-20 min',
                    description: 'Audit focusing on food storage and dry storage practices',
                    masterLists: ['Food Storage & Dry Storage']
                },
                {
                    id: 'fridges-freezers',
                    name: 'Fridges and Freezers',
                    type: 'Section Audit',
                    sections: 1,
                    questionCount: await this.getListItemCount('Fridges and Freezers'),
                    duration: '15-20 min',
                    description: 'Temperature monitoring and refrigeration equipment audit',
                    masterLists: ['Fridges and Freezers']
                },
                {
                    id: 'food-handling',
                    name: 'Food Handling',
                    type: 'Section Audit',
                    sections: 1,
                    questionCount: await this.getListItemCount('Food Handling'),
                    duration: '15-20 min',
                    description: 'Food handling procedures and practices',
                    masterLists: ['Food Handling']
                },
                {
                    id: 'cleaning-disinfection',
                    name: 'Cleaning and Disinfection',
                    type: 'Section Audit',
                    sections: 1,
                    questionCount: await this.getListItemCount('Cleaning and Disinfection'),
                    duration: '15-20 min',
                    description: 'Cleaning procedures and sanitation practices',
                    masterLists: ['Cleaning and Disinfection']
                },
                {
                    id: 'personal-hygiene',
                    name: 'Personal Hygiene',
                    type: 'Section Audit',
                    sections: 1,
                    questionCount: await this.getListItemCount('Personal Hygiene'),
                    duration: '10-15 min',
                    description: 'Employee hygiene and grooming standards',
                    masterLists: ['Personal Hygiene']
                }
            ];
            
            console.log(`[CHECKLISTS] Built ${checklists.length} checklist options`);
            
            // Cache the results
            this.cachedChecklists = checklists;
            this.cacheTimestamp = Date.now();
            
            return checklists;
            
        } catch (error) {
            console.error('[CHECKLISTS] Error building checklists:', error);
            return this.getFallbackChecklists();
        }
    }
    
    /**
     * Get all master list names
     */
    getAllMasterLists() {
        return [
            'Food Storage & Dry Storage',
            'Fridges and Freezers',
            'Utensils and Equipment',
            'Food Handling',
            'Cleaning and Disinfection',
            'Personal Hygiene',
            'Restrooms',
            'Garbage Storage & Disposal',
            'Maintenance',
            'Chemicals Available',
            'Monitoring Sheets',
            'Food Safety Culture',
            'Policies & Procedures'
        ];
    }
    
    /**
     * Get question count for a specific master list
     */
    async getListItemCount(listName) {
        try {
            const items = await this.graphConnector.getListItems(listName, {
                select: 'fields',
                top: 1000
            });
            
            return items.length;
            
        } catch (error) {
            console.error(`[CHECKLISTS] Error counting items in ${listName}:`, error);
            return 'N/A';
        }
    }
    
    /**
     * Get total question count across all master lists
     */
    async getTotalQuestionCount() {
        try {
            const masterLists = this.getAllMasterLists();
            let total = 0;
            
            for (const listName of masterLists) {
                const count = await this.getListItemCount(listName);
                if (typeof count === 'number') {
                    total += count;
                }
            }
            
            return total;
            
        } catch (error) {
            console.error('[CHECKLISTS] Error calculating total questions:', error);
            return 'N/A';
        }
    }
    
    /**
     * Get checklist details by ID
     */
    async getChecklistById(checklistId) {
        const checklists = await this.getChecklistsList();
        return checklists.find(c => c.id === checklistId);
    }
    
    /**
     * Get questions for a checklist (from master lists)
     */
    async getChecklistQuestions(checklistId) {
        try {
            const checklist = await this.getChecklistById(checklistId);
            
            if (!checklist) {
                throw new Error('Checklist not found');
            }
            
            await this.initialize();
            
            const allQuestions = [];
            
            // Fetch questions from each master list
            for (const masterList of checklist.masterLists) {
                const items = await this.graphConnector.getListItems(masterList, {
                    select: 'fields',
                    top: 1000
                });
                
                const questions = items.map(item => ({
                    section: masterList,
                    title: item.fields.Title,
                    coeff: item.fields.Coeff || 1,
                    answer: item.fields.Answer || 'Yes,Partially,No,NA',
                    cr: item.fields.cr || '',
                    referenceValue: item.fields.ReferenceValue || ''
                }));
                
                allQuestions.push(...questions);
            }
            
            console.log(`[CHECKLISTS] Loaded ${allQuestions.length} questions for ${checklistId}`);
            
            return allQuestions;
            
        } catch (error) {
            console.error(`[CHECKLISTS] Error loading questions for ${checklistId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get fallback checklists (in case SharePoint is unavailable)
     */
    getFallbackChecklists() {
        console.log('[CHECKLISTS] Using fallback checklist list');
        
        return [
            {
                id: 'fs-survey-complete',
                name: 'Complete Food Safety Survey',
                type: 'Full Audit',
                sections: 13,
                questionCount: 'N/A',
                duration: '90-120 min',
                description: 'Complete audit covering all 13 food safety sections',
                masterLists: this.getAllMasterLists()
            },
            {
                id: 'food-storage',
                name: 'Food Storage & Dry Storage',
                type: 'Section Audit',
                sections: 1,
                questionCount: 'N/A',
                duration: '15-20 min',
                description: 'Audit focusing on food storage and dry storage practices',
                masterLists: ['Food Storage & Dry Storage']
            },
            {
                id: 'fridges-freezers',
                name: 'Fridges and Freezers',
                type: 'Section Audit',
                sections: 1,
                questionCount: 'N/A',
                duration: '15-20 min',
                description: 'Temperature monitoring and refrigeration equipment audit',
                masterLists: ['Fridges and Freezers']
            }
        ];
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cachedChecklists = null;
        this.cacheTimestamp = null;
        console.log('[CHECKLISTS] Cache cleared');
    }
}

module.exports = ChecklistsService;
