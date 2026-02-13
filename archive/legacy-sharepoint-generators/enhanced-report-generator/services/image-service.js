/**
 * Image Service
 * Handles image download and conversion to base64, filtering by Iscorrective flag
 */

const { extractQuestionId, escapeQuotes } = require('./utilities');

class ImageService {
    constructor(connector) {
        this.connector = connector;
    }

    /**
     * Download image and convert to base64 data URL
     * @param {Object} imageItem - Image item from SharePoint
     * @returns {Promise<string>} - Base64 data URL
     */
    async downloadImageAsBase64(imageItem) {
        try {
            // Check if connector has a downloadFile method
            if (this.connector && typeof this.connector.downloadFile === 'function') {
                // Use connector's downloadFile method if available
                const fileUrl = imageItem.FileRef || imageItem.ServerRelativeUrl || imageItem.url || imageItem.restApiUrl;
                
                if (!fileUrl) {
                    console.warn('No file URL found for image');
                    return '';
                }

                console.log(`📥 Downloading image: ${fileUrl}`);

                // Download the file as a buffer
                const fileBuffer = await this.connector.downloadFile(fileUrl);
                
                if (!fileBuffer) {
                    console.warn('Failed to download image');
                    return '';
                }

                // Detect image type from filename
                const extension = fileUrl.split('.').pop().toLowerCase();
                let mimeType = 'image/jpeg'; // default
                
                if (extension === 'png') mimeType = 'image/png';
                else if (extension === 'gif') mimeType = 'image/gif';
                else if (extension === 'bmp') mimeType = 'image/bmp';
                else if (extension === 'webp') mimeType = 'image/webp';

                // Convert buffer to base64
                const base64String = fileBuffer.toString('base64');
                const dataUrl = `data:${mimeType};base64,${base64String}`;

                console.log(`✅ Image converted to base64 (${(base64String.length / 1024).toFixed(2)} KB)`);
                
                return dataUrl;
            } else {
                // Fallback: use REST API directly with fetch (for SimpleGraphConnector)
                const fileUrl = imageItem.restApiUrl;
                
                if (!fileUrl) {
                    console.warn('No restApiUrl found for image');
                    return '';
                }

                console.log(`📥 Downloading image via REST API: ${imageItem.fileName || fileUrl}`);

                const response = await fetch(fileUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.connector.accessToken}`,
                        'Accept': 'application/octet-stream'
                    }
                });

                if (!response.ok) {
                    console.warn(`⚠️ Failed to download image: ${response.status} ${response.statusText}`);
                    return '';
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64String = buffer.toString('base64');
                
                // Determine MIME type based on file extension
                const fileName = imageItem.fileName || fileUrl.split('/').pop();
                const extension = fileName.toLowerCase().split('.').pop();
                let mimeType = 'image/jpeg'; // default
                
                if (extension === 'png') mimeType = 'image/png';
                else if (extension === 'gif') mimeType = 'image/gif';
                else if (extension === 'webp') mimeType = 'image/webp';
                else if (extension === 'bmp') mimeType = 'image/bmp';
                
                const dataUrl = `data:${mimeType};base64,${base64String}`;
                console.log(`✅ Successfully converted ${fileName} to base64 (${Math.round(base64String.length/1024)}KB)`);
                
                return dataUrl;
            }

        } catch (error) {
            console.error('Error downloading/converting image:', error.message);
            return '';
        }
    }

    /**
     * Convert all images in a collection to base64 and group by extracted question ID
     * @param {Object} images - Object with image arrays keyed by ImageID
     * @returns {Promise<Object>} - Images grouped by question ID with base64 URLs
     */
    async convertImagesToBase64(images) {
        const convertedImages = {};
        
        for (const imageID in images) {
            // Extract question ID from full ImageID format: "GMRL-FSACR-0048-87" → "87"
            const questionId = extractQuestionId(imageID);
            
            if (!convertedImages[questionId]) {
                convertedImages[questionId] = [];
            }
            
            for (let i = 0; i < images[imageID].length; i++) {
                const imageItem = images[imageID][i];
                const base64Url = await this.downloadImageAsBase64(imageItem);
                
                convertedImages[questionId].push({
                    ...imageItem,
                    url: base64Url,
                    imageID: imageID,
                    questionId: questionId,
                    // Preserve Iscorrective flag for filtering
                    isCorrective: imageItem.Iscorrective === true || imageItem.Iscorrective === 'true' || imageItem.Iscorrective === 1
                });
            }
        }
        
        return convertedImages;
    }

    /**
     * Filter images by Iscorrective flag
     * @param {Array} images - Array of image objects
     * @param {boolean} isCorrective - True for "after" photos, false for "before" photos
     * @returns {Array} - Filtered images
     */
    filterImagesByCorrective(images, isCorrective) {
        if (!images || images.length === 0) return [];
        return images.filter(img => img.isCorrective === isCorrective);
    }

    /**
     * Generate image gallery HTML with Iscorrective filtering (ENHANCED)
     * @param {string} questionId - Question ID
     * @param {Object} imageMap - Images collection grouped by question ID
     * @param {boolean} showCorrectiveOnly - If true, show only Iscorrective=true (after photos)
     * @returns {string} - HTML for image gallery
     */
    generateImageGallery(questionId, imageMap, showCorrectiveOnly = false) {
        const allImages = imageMap[questionId] || [];
        
        if (allImages.length === 0) {
            return '<span style="color: #ccc;">—</span>';
        }

        // Filter images by Iscorrective flag
        let imagesToShow;
        if (showCorrectiveOnly) {
            // Show only "after" photos (Iscorrective = true)
            imagesToShow = this.filterImagesByCorrective(allImages, true);
        } else {
            // Show only "before" photos (Iscorrective = false)
            imagesToShow = this.filterImagesByCorrective(allImages, false);
        }

        if (imagesToShow.length === 0) {
            return '<span style="color: #ccc;">—</span>';
        }

        // Create 2-column grid layout
        const imageElements = imagesToShow.map((img, index) => {
            const imageUrl = img.url || '';
            const imageID = img.imageID || img.ImageID || img.ID || 'N/A';
            const created = img.Created ? new Date(img.Created).toLocaleString() : '';
            const title = img.Title || img.fileName || `${showCorrectiveOnly ? 'After' : 'Before'} Image`;

            return `<img 
                        src='${imageUrl}' 
                        class='image-thumbnail' 
                        onclick='openImageModal("${escapeQuotes(imageUrl)}","${escapeQuotes(title)}","${escapeQuotes(imageID)}","${created}")' 
                        alt='${title}' 
                        title='Click to enlarge - ${imageID}'>`;
        }).join('');

        return `<div class='image-gallery'>${imageElements}</div>`;
    }

    /**
     * Generate fridge picture cell HTML with base64 images (from lines 1407-1428)
     * @param {Array<string>} base64Images - Array of base64 image data URIs
     * @param {string} label - Label for images (e.g., "Fridge Image")
     * @returns {string} HTML for picture cell
     */
    generateFridgePictureCell(base64Images, label = 'Fridge Image') {
        if (!base64Images || base64Images.length === 0) {
            return '<span style="color: #999;">—</span>';
        }

        const imageHtml = base64Images.map((base64, index) => `
            <img src='${base64}' 
                 class='image-thumbnail' 
                 onclick='openImageModal("${escapeQuotes(base64)}","${label} ${index + 1}","","")' 
                 alt='${label} ${index + 1}' 
                 title='Click to enlarge'
                 style='max-width: 100px; max-height: 100px; cursor: pointer; margin: 4px;'>
        `).join('');

        return `<div class='image-gallery' style='display: flex; flex-wrap: wrap; gap: 4px;'>${imageHtml}</div>`;
    }

    /**
     * Check if images exist for a question
     * @param {string} questionId - Question ID
     * @param {Object} images - Images collection
     * @returns {boolean} - True if images exist
     */
    hasImages(questionId, images) {
        const questionImages = images[questionId] || [];
        return questionImages.length > 0;
    }

    /**
     * Get image count for a question
     * @param {string} questionId - Question ID
     * @param {Object} images - Images collection
     * @param {boolean|null} filterCorrective - If true/false, filter by Iscorrective flag
     * @returns {number} - Count of images
     */
    getImageCount(questionId, images, filterCorrective = null) {
        const questionImages = images[questionId] || [];
        
        if (filterCorrective === null) {
            return questionImages.length;
        }
        
        return this.filterImagesByCorrective(questionImages, filterCorrective).length;
    }
}

module.exports = ImageService;
