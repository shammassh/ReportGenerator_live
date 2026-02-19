/**
 * File Storage Service
 * Handles file-based picture storage instead of SQL BLOB storage
 * Pictures are saved to disk with paths stored in database
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileStorageService {
    constructor() {
        // Base directory for all picture storage
        this.baseDir = path.join(__dirname, '..', 'storage', 'pictures');
        this.initialized = false;
    }

    /**
     * Initialize storage directories
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Create base directory structure
            await fs.mkdir(this.baseDir, { recursive: true });
            
            // Create subdirectories for organization
            const subdirs = ['audits', 'responses', 'temp'];
            for (const subdir of subdirs) {
                await fs.mkdir(path.join(this.baseDir, subdir), { recursive: true });
            }
            
            this.initialized = true;
            console.log('📁 [FileStorage] Storage directories initialized:', this.baseDir);
        } catch (error) {
            console.error('Error initializing file storage:', error);
            throw error;
        }
    }

    /**
     * Generate unique filename for a picture
     */
    generateFileName(pictureId, originalName, contentType) {
        const ext = this.getExtension(contentType, originalName);
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(`${pictureId}-${timestamp}`).digest('hex').substring(0, 8);
        return `${pictureId}_${hash}${ext}`;
    }

    /**
     * Get file extension from content type or original filename
     */
    getExtension(contentType, originalName) {
        const contentTypeMap = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp'
        };
        
        if (contentType && contentTypeMap[contentType.toLowerCase()]) {
            return contentTypeMap[contentType.toLowerCase()];
        }
        
        if (originalName) {
            const ext = path.extname(originalName).toLowerCase();
            if (ext) return ext;
        }
        
        return '.jpg'; // Default
    }

    /**
     * Get directory path for an audit's pictures
     */
    getAuditDir(auditId) {
        return path.join(this.baseDir, 'audits', String(auditId));
    }

    /**
     * Get directory path for a response's pictures
     */
    getResponseDir(auditId, responseId) {
        return path.join(this.baseDir, 'audits', String(auditId), 'responses', String(responseId));
    }

    /**
     * Save a picture to file system
     * @param {Object} pictureData - { pictureId, auditId, responseId, fileName, fileData (Buffer or base64), contentType, pictureType }
     * @returns {Object} - { filePath, relativePath, url }
     */
    async savePicture(pictureData) {
        await this.initialize();
        
        const { pictureId, auditId, responseId, fileName, fileData, contentType, pictureType } = pictureData;
        
        // Create directory structure
        const responseDir = this.getResponseDir(auditId, responseId);
        await fs.mkdir(responseDir, { recursive: true });
        
        // Generate unique filename
        const uniqueFileName = this.generateFileName(pictureId, fileName, contentType);
        const filePath = path.join(responseDir, uniqueFileName);
        
        // Convert to Buffer if base64
        const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData, 'base64');
        
        // Write file
        await fs.writeFile(filePath, buffer);
        
        // Generate relative path for storage in DB (from storage root)
        const relativePath = path.relative(this.baseDir, filePath).replace(/\\/g, '/');
        
        // Generate URL for serving
        const url = `/api/pictures/file/${relativePath}`;
        
        console.log(`📁 [FileStorage] Saved picture ${pictureId} to ${relativePath}`);
        
        return {
            filePath,
            relativePath,
            url,
            fileName: uniqueFileName,
            size: buffer.length
        };
    }

    /**
     * Read a picture from file system
     * @param {string} relativePath - Relative path from storage root
     * @returns {Object} - { buffer, contentType }
     */
    async readPicture(relativePath) {
        await this.initialize();
        
        const filePath = path.join(this.baseDir, relativePath);
        
        // Security check - ensure path is within baseDir
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(this.baseDir))) {
            throw new Error('Invalid file path');
        }
        
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(relativePath).toLowerCase();
        
        const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp'
        };
        
        return {
            buffer,
            contentType: contentTypeMap[ext] || 'image/jpeg'
        };
    }

    /**
     * Read a picture by pictureId (lookup from DB would be needed)
     * This is a convenience method for direct file access
     */
    async readPictureById(pictureId, auditId, responseId, fileName) {
        const responseDir = this.getResponseDir(auditId, responseId);
        const filePath = path.join(responseDir, fileName);
        
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(fileName).toLowerCase();
        
        const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp'
        };
        
        return {
            buffer,
            contentType: contentTypeMap[ext] || 'image/jpeg'
        };
    }

    /**
     * Delete a picture from file system
     */
    async deletePicture(relativePath) {
        await this.initialize();
        
        const filePath = path.join(this.baseDir, relativePath);
        
        // Security check
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(this.baseDir))) {
            throw new Error('Invalid file path');
        }
        
        try {
            await fs.unlink(filePath);
            console.log(`📁 [FileStorage] Deleted picture at ${relativePath}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`📁 [FileStorage] Picture not found: ${relativePath}`);
                return false;
            }
            throw error;
        }
    }

    /**
     * Check if a picture file exists
     */
    async pictureExists(relativePath) {
        await this.initialize();
        
        const filePath = path.join(this.baseDir, relativePath);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats() {
        await this.initialize();
        
        let totalFiles = 0;
        let totalSize = 0;
        
        async function walkDir(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await walkDir(fullPath);
                    } else {
                        totalFiles++;
                        const stat = await fs.stat(fullPath);
                        totalSize += stat.size;
                    }
                }
            } catch (error) {
                // Directory might not exist yet
            }
        }
        
        await walkDir(this.baseDir);
        
        return {
            totalFiles,
            totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            baseDir: this.baseDir
        };
    }

    /**
     * Convert picture metadata to URL-based format (strip base64)
     * Used for cache storage
     */
    pictureToMetadata(picture) {
        return {
            pictureId: picture.pictureId,
            fileName: picture.fileName,
            contentType: picture.contentType,
            pictureType: picture.pictureType,
            filePath: picture.filePath || null,
            url: picture.url || `/api/pictures/${picture.pictureId}`
            // Explicitly NOT including: base64, fileData
        };
    }

    /**
     * Strip base64 data from report items for cache storage
     * @param {Object} reportData - Full report data with embedded pictures
     * @returns {Object} - Report data with pictures replaced by URLs
     */
    stripPicturesForCache(reportData) {
        if (!reportData) return reportData;
        
        const stripped = JSON.parse(JSON.stringify(reportData)); // Deep clone
        
        if (stripped.items && Array.isArray(stripped.items)) {
            for (const item of stripped.items) {
                if (item.pictures && Array.isArray(item.pictures)) {
                    item.pictures = item.pictures.map(pic => this.pictureToMetadata(pic));
                }
            }
        }
        
        return stripped;
    }
}

module.exports = new FileStorageService();
