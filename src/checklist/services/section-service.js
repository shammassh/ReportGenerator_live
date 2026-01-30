/**
 * Section Service Module
 * Handles all section-related operations
 * Independent and reusable
 */

const SQLConnector = require('../../sql-connector');
const sql = require('mssql');

class SectionService {
    constructor() {
        this.sqlConnector = new SQLConnector();
    }

    /**
     * Create a new section
     * @param {Object} sectionData
     * @param {string} sectionData.sectionName - Name of the section
     * @param {number} sectionData.sectionNumber - Section number (optional)
     * @param {string} sectionData.icon - Icon emoji (optional)
     * @param {string} sectionData.description - Description (optional)
     * @param {string} sectionData.createdBy - User who created it
     * @returns {Promise<Object>}
     */
    async createSection(sectionData) {
        try {
            console.log(`📋 Creating section: ${sectionData.sectionName}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('SectionName', sql.NVarChar(200), sectionData.sectionName);
            request.input('SectionNumber', sql.Int, sectionData.sectionNumber || null);
            request.input('Icon', sql.NVarChar(10), sectionData.icon || null);
            request.input('Description', sql.NVarChar(sql.MAX), sectionData.description || null);
            request.input('CreatedBy', sql.NVarChar(100), sectionData.createdBy);

            const result = await request.execute('sp_CreateChecklistSection');
            
            console.log(`✅ Section created successfully (ID: ${result.recordset[0].SectionID})`);
            
            return {
                success: true,
                sectionId: result.recordset[0].SectionID,
                message: result.recordset[0].Message
            };
        } catch (error) {
            console.error('❌ Error creating section:', error.message);
            throw error;
        }
    }

    /**
     * Get all sections
     * @param {boolean} activeOnly - Return only active sections
     * @returns {Promise<Object>}
     */
    async getSections(activeOnly = true) {
        try {
            console.log(`📋 Fetching sections (active only: ${activeOnly})`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ActiveOnly', sql.Bit, activeOnly);
            const result = await request.execute('sp_GetChecklistSections');
            
            console.log(`✅ Found ${result.recordset.length} sections`);
            
            return {
                success: true,
                sections: result.recordset
            };
        } catch (error) {
            console.error('❌ Error fetching sections:', error.message);
            throw error;
        }
    }

    /**
     * Get section by ID
     * @param {number} sectionId - Section ID
     * @returns {Promise<Object>}
     */
    async getSectionById(sectionId) {
        try {
            console.log(`📋 Fetching section ${sectionId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('SectionID', sql.Int, sectionId);
            const result = await request.execute('sp_GetChecklistSectionById');
            
            if (result.recordset.length === 0) {
                throw new Error('Section not found');
            }
            
            console.log(`✅ Section found: ${result.recordset[0].SectionName}`);
            
            return {
                success: true,
                section: result.recordset[0]
            };
        } catch (error) {
            console.error('❌ Error fetching section:', error.message);
            throw error;
        }
    }

    /**
     * Update section
     * @param {number} sectionId - Section ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updateSection(sectionId, updates) {
        try {
            console.log(`📝 Updating section ${sectionId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('SectionID', sql.Int, sectionId);
            request.input('SectionName', sql.NVarChar(200), updates.sectionName || null);
            request.input('SectionNumber', sql.Int, updates.sectionNumber || null);
            request.input('Icon', sql.NVarChar(10), updates.icon || null);
            request.input('Description', sql.NVarChar(sql.MAX), updates.description || null);

            await request.execute('sp_UpdateChecklistSection');
            
            console.log(`✅ Section ${sectionId} updated successfully`);
            
            return {
                success: true,
                message: 'Section updated successfully'
            };
        } catch (error) {
            console.error('❌ Error updating section:', error.message);
            throw error;
        }
    }

    /**
     * Deactivate section
     * @param {number} sectionId - Section ID
     * @returns {Promise<Object>}
     */
    async deactivateSection(sectionId) {
        try {
            console.log(`🔒 Deactivating section ${sectionId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('SectionID', sql.Int, sectionId);

            await request.execute('sp_DeactivateChecklistSection');
            
            console.log(`✅ Section ${sectionId} deactivated successfully`);
            
            return {
                success: true,
                message: 'Section deactivated successfully'
            };
        } catch (error) {
            console.error('❌ Error deactivating section:', error.message);
            throw error;
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        return await this.sqlConnector.testConnection();
    }

    /**
     * Close database connection
     */
    async close() {
        await this.sqlConnector.disconnect();
    }
}

module.exports = SectionService;
