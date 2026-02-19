/**
 * Image Optimization Service
 * 
 * Handles resizing and compression of uploaded images to reduce storage
 * and improve loading performance.
 * 
 * Settings:
 * - Max dimensions: 1600x1200px (landscape) or 1200x1600px (portrait)
 * - JPEG quality: 85%
 * - PNG > 200KB converted to JPEG (unless has transparency)
 * - EXIF data stripped for privacy
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class ImageOptimizer {
    constructor(options = {}) {
        this.maxWidth = options.maxWidth || 1600;
        this.maxHeight = options.maxHeight || 1200;
        this.jpegQuality = options.jpegQuality || 85;
        this.pngToJpegThreshold = options.pngToJpegThreshold || 200 * 1024; // 200KB
        this.skipIfSmaller = options.skipIfSmaller || 50 * 1024; // Skip files < 50KB
    }

    /**
     * Optimize an image buffer
     * @param {Buffer} inputBuffer - Original image data
     * @param {string} originalName - Original filename (for extension detection)
     * @returns {Promise<{buffer: Buffer, format: string, optimized: boolean, savings: number}>}
     */
    async optimizeBuffer(inputBuffer, originalName) {
        const originalSize = inputBuffer.length;
        
        // Skip tiny images
        if (originalSize < this.skipIfSmaller) {
            return {
                buffer: inputBuffer,
                format: path.extname(originalName).slice(1).toLowerCase(),
                optimized: false,
                savings: 0,
                reason: 'Too small to optimize'
            };
        }

        try {
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();
            
            // Determine if we need to resize
            const needsResize = metadata.width > this.maxWidth || metadata.height > this.maxHeight;
            
            // Determine output format
            let outputFormat = metadata.format;
            let convertPngToJpeg = false;
            
            // Check if PNG should be converted to JPEG
            if (metadata.format === 'png' && originalSize > this.pngToJpegThreshold) {
                // Check for transparency
                if (!metadata.hasAlpha) {
                    convertPngToJpeg = true;
                    outputFormat = 'jpeg';
                }
            }

            // Build the processing pipeline
            let pipeline = image;
            
            // Resize if needed (maintain aspect ratio)
            if (needsResize) {
                pipeline = pipeline.resize(this.maxWidth, this.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }
            
            // Strip EXIF data and rotate based on EXIF orientation
            pipeline = pipeline.rotate(); // Auto-rotate based on EXIF
            
            // Apply format-specific compression
            if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
                pipeline = pipeline.jpeg({
                    quality: this.jpegQuality,
                    mozjpeg: true // Better compression
                });
            } else if (outputFormat === 'png') {
                pipeline = pipeline.png({
                    compressionLevel: 9,
                    adaptiveFiltering: true
                });
            } else if (outputFormat === 'webp') {
                pipeline = pipeline.webp({
                    quality: this.jpegQuality
                });
            }
            
            const outputBuffer = await pipeline.toBuffer();
            const newSize = outputBuffer.length;
            
            // Only use optimized version if it's actually smaller
            if (newSize < originalSize) {
                return {
                    buffer: outputBuffer,
                    format: outputFormat === 'jpeg' ? 'jpg' : outputFormat,
                    optimized: true,
                    originalSize,
                    newSize,
                    savings: originalSize - newSize,
                    savingsPercent: Math.round((1 - newSize / originalSize) * 100),
                    resized: needsResize,
                    converted: convertPngToJpeg
                };
            } else {
                return {
                    buffer: inputBuffer,
                    format: path.extname(originalName).slice(1).toLowerCase(),
                    optimized: false,
                    savings: 0,
                    reason: 'Optimized version was larger'
                };
            }
        } catch (error) {
            console.warn('Image optimization failed, using original:', error.message);
            return {
                buffer: inputBuffer,
                format: path.extname(originalName).slice(1).toLowerCase(),
                optimized: false,
                savings: 0,
                reason: `Error: ${error.message}`
            };
        }
    }

    /**
     * Optimize an image file in place (with backup option)
     * @param {string} filePath - Path to the image file
     * @param {string} backupDir - Directory to store original (null = no backup)
     * @returns {Promise<Object>} - Optimization result
     */
    async optimizeFile(filePath, backupDir = null) {
        const inputBuffer = await fs.readFile(filePath);
        const originalName = path.basename(filePath);
        
        const result = await this.optimizeBuffer(inputBuffer, originalName);
        
        if (result.optimized) {
            // Backup original if requested
            if (backupDir) {
                const relativePath = filePath.includes('storage') 
                    ? filePath.split('storage')[1] 
                    : path.basename(filePath);
                const backupPath = path.join(backupDir, relativePath);
                await fs.mkdir(path.dirname(backupPath), { recursive: true });
                await fs.writeFile(backupPath, inputBuffer);
            }
            
            // Determine new filename if format changed
            let newFilePath = filePath;
            if (result.converted) {
                const ext = path.extname(filePath);
                newFilePath = filePath.slice(0, -ext.length) + '.jpg';
            }
            
            // Write optimized file
            await fs.writeFile(newFilePath, result.buffer);
            
            // Remove old file if format changed
            if (newFilePath !== filePath) {
                await fs.unlink(filePath);
            }
            
            result.newPath = newFilePath;
        }
        
        result.filePath = filePath;
        return result;
    }

    /**
     * Get statistics about potential savings for a directory
     * @param {string} dir - Directory to scan
     * @returns {Promise<Object>} - Statistics
     */
    async analyzeDirectory(dir) {
        const stats = {
            totalFiles: 0,
            totalSize: 0,
            needsResize: 0,
            pngToConvert: 0,
            estimatedSavings: 0
        };

        const scan = async (currentDir) => {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath);
                } else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                        const fileStat = await fs.stat(fullPath);
                        stats.totalFiles++;
                        stats.totalSize += fileStat.size;
                        
                        try {
                            const metadata = await sharp(fullPath).metadata();
                            if (metadata.width > this.maxWidth || metadata.height > this.maxHeight) {
                                stats.needsResize++;
                            }
                            if (ext === '.png' && fileStat.size > this.pngToJpegThreshold && !metadata.hasAlpha) {
                                stats.pngToConvert++;
                            }
                        } catch (e) {
                            // Skip files that can't be read
                        }
                    }
                }
            }
        };

        await scan(dir);
        
        // Estimate savings (rough estimate: 60% reduction for oversized images)
        stats.estimatedSavings = Math.round(stats.totalSize * 0.6);
        
        return stats;
    }
}

module.exports = new ImageOptimizer();
module.exports.ImageOptimizer = ImageOptimizer;
