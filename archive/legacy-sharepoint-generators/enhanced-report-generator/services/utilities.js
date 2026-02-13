/**
 * Utility Functions
 * Common helper functions for text processing, field mapping, and data extraction
 */

/**
 * Clean text by handling escaped newlines and tabs (from original file)
 * Used for SharePoint text fields that may contain escaped characters
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text with HTML line breaks
 */
function cleanText(text) {
    if (!text) return text;
    return String(text)
        .replace(/\\n/g, '<br>')  // Escaped newlines
        .replace(/\n/g, '<br>')   // Actual newlines
        .replace(/\\t/g, '    ')  // Escaped tabs
        .replace(/\t/g, '    ');  // Actual tabs
}

/**
 * Extract question ID from full ImageID format
 * Converts "GMRL-FSACR-0048-87" → "87"
 * @param {string|number} imageId - Full image ID or question ID
 * @returns {string} - Extracted question ID
 */
function extractQuestionId(imageId) {
    if (!imageId) return '';
    const fullImageId = String(imageId);
    return fullImageId.includes('-') ? fullImageId.split('-').pop() : fullImageId;
}

/**
 * Get comment from multiple possible field names
 * SharePoint uses different field names for comments across lists
 * @param {Object} item - Item object
 * @returns {string} - Comment text or '-' if none found
 */
function getComment(item) {
    return item.comment || item.Comments || item.Note || item.notes || '-';
}

/**
 * Get criteria from multiple possible field names
 * @param {Object} item - Item object
 * @returns {string} - Criteria text
 */
function getCriteria(item) {
    return item.Title || item.Question || item.Criteria || item.cr || 'Criteria not specified';
}

/**
 * Get reference value or fallback to index
 * @param {Object} item - Item object
 * @param {number} index - Fallback index
 * @returns {string|number} - Reference value or index
 */
function getReferenceValue(item, index) {
    return item.ReferenceValue || item.Reference || item.Ref || (index + 1);
}

/**
 * Get coefficient display value (blank for NA answers)
 * @param {Object} item - Item object
 * @returns {string} - Coefficient value or empty string for NA
 */
function getCoefficientDisplay(item) {
    const selectedChoice = item.SelectedChoice || item.Answer || '';
    if (selectedChoice === 'NA') return '';
    return String(item.Coeff || item.Coefficient || '-');
}

/**
 * Get answer display value
 * @param {Object} item - Item object
 * @returns {string} - Answer value or "No Answer"
 */
function getAnswerDisplay(item) {
    const answer = item.SelectedChoice || item.Answer || '';
    return (answer && answer.trim()) || 'No Answer';
}

/**
 * Parse SharePoint date string to locale date
 * @param {string} dateString - SharePoint date string
 * @returns {string} - Formatted date string
 */
function parseSharePointDate(dateString) {
    if (!dateString) return new Date().toLocaleDateString();
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch (error) {
        return new Date().toLocaleDateString();
    }
}

/**
 * Parse SharePoint date string to locale time
 * @param {string} dateString - SharePoint date string
 * @returns {string} - Formatted time string
 */
function parseSharePointTime(dateString) {
    if (!dateString) return new Date().toLocaleTimeString();
    
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    } catch (error) {
        return new Date().toLocaleTimeString();
    }
}

/**
 * Get store name from multiple possible sources
 * @param {Object} surveyData - Survey data object
 * @param {string} documentNumber - Document number as fallback
 * @returns {string} - Store name
 */
function getStoreName(surveyData, documentNumber) {
    return surveyData?.Store_x0020_Name || 
           surveyData?.Store_Name || 
           surveyData?.StoreName || 
           surveyData?.Store || 
           surveyData?.['Store Name'] || 
           (documentNumber ? documentNumber.split('-')[0] : 'N/A');
}

/**
 * Get auditor name from multiple possible sources
 * @param {Object} surveyData - Survey data object
 * @param {string} fallback - Fallback value
 * @returns {string} - Auditor name
 */
function getAuditor(surveyData, fallback = 'System Generated') {
    return surveyData?.Auditor || surveyData?.Author || fallback;
}

/**
 * Check if item has corrective action required
 * Item needs corrective action if Coeff !== Value and not NA
 * @param {Object} item - Item object
 * @returns {boolean} - True if corrective action required
 */
function needsCorrectiveAction(item) {
    const coeff = parseFloat(item.Coeff || 0);
    const value = parseFloat(item.Value || 0);
    const selectedChoice = item.SelectedChoice || '';
    
    return coeff !== value && selectedChoice !== 'NA';
}

/**
 * Format score for display with PASS/FAIL indicator
 * @param {number} score - Score value
 * @param {boolean} isResult - Whether this is final result (uses 83% threshold)
 * @returns {string} - Formatted HTML score
 */
function getFormattedScoreHTML(score, isResult = false) {
    const roundedScore = Math.round(score);
    const emoji = getScoreEmoji(roundedScore);
    const threshold = isResult ? 83 : 89;
    const bgColor = roundedScore > threshold ? '#28a745' : '#dc3545';
    
    if (isResult) {
        const status = roundedScore > 83 ? 'PASS' : 'FAIL';
        return `<div style='background-color:${bgColor}; color:white; padding:8px 16px; border-radius:4px; font-weight:bold; text-align:center;'>${status}</div>`;
    }
    
    return `${roundedScore} ${emoji}`;
}

/**
 * Get emoji for score
 * @param {number} score - Score value
 * @returns {string} - Emoji
 */
function getScoreEmoji(score) {
    if (score === 0) return "⚪";
    if (score < 83) return "🔴";
    return "🟢";
}

/**
 * Escape single quotes for JavaScript string literals
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}

/**
 * Create 2-column image grid HTML
 * @param {Array} images - Array of image objects with url property
 * @param {string} type - Type of images ('before' or 'after')
 * @returns {string} - HTML for image grid
 */
function createImageGrid(images, type = 'before') {
    if (!images || images.length === 0) {
        return '<span style="color: #ccc;">—</span>';
    }

    const imageHtml = images.map((img, idx) => {
        const label = type === 'after' ? 'After' : 'Before';
        const title = img.fileName || img.title || `${label} Image`;
        const imageID = img.imageID || img.ImageID || '';
        const created = img.created ? new Date(img.created).toLocaleString() : '';
        
        return `<img src='${img.url}' 
                     class='image-thumbnail' 
                     onclick='openImageModal("${escapeQuotes(img.url)}","${label}: ${escapeQuotes(title)}","${escapeQuotes(imageID)}","${created}")' 
                     alt='${label}: ${title}' 
                     title='Click to enlarge - ${imageID}'>`;
    }).join('');
    
    return `<div class='image-gallery'>${imageHtml}</div>`;
}

module.exports = {
    cleanText,
    extractQuestionId,
    getComment,
    getCriteria,
    getReferenceValue,
    getCoefficientDisplay,
    getAnswerDisplay,
    parseSharePointDate,
    parseSharePointTime,
    getStoreName,
    getAuditor,
    needsCorrectiveAction,
    getFormattedScoreHTML,
    getScoreEmoji,
    escapeQuotes,
    createImageGrid
};
