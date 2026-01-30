/**
 * Utility Functions
 * Common helper functions for text processing, field mapping, and data extraction
 */

/**
 * Clean text by handling escaped newlines and tabs
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text with HTML line breaks
 */
function cleanText(text) {
    if (!text) return text;
    return String(text)
        .replace(/\\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .replace(/\\t/g, '    ')
        .replace(/\t/g, '    ');
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
}

/**
 * Format time for display
 * @param {string} time - Time string (HH:MM format)
 * @returns {string} - Formatted time
 */
function formatTime(time) {
    if (!time) return 'N/A';
    return time;
}

/**
 * Get priority badge HTML
 * @param {string} priority - Priority level
 * @returns {string} - HTML badge
 */
function getPriorityBadge(priority) {
    if (!priority) return '';
    
    const badges = {
        'High': '<span class="priority-badge priority-high">High</span>',
        'Medium': '<span class="priority-badge priority-medium">Medium</span>',
        'Low': '<span class="priority-badge priority-low">Low</span>'
    };
    
    return badges[priority] || '';
}

/**
 * Get answer class for styling
 * @param {string} answer - Selected answer
 * @returns {string} - CSS class name
 */
function getAnswerClass(answer) {
    if (!answer) return 'answer-none';
    
    const classes = {
        'Yes': 'answer-yes',
        'Partially': 'answer-partial',
        'No': 'answer-no',
        'NA': 'answer-na'
    };
    
    return classes[answer] || 'answer-none';
}

/**
 * Get section icon
 * @param {string} iconName - Icon name or emoji
 * @param {number} sectionNumber - Section number fallback
 * @returns {string} - Icon or emoji
 */
function getSectionIcon(iconName, sectionNumber) {
    if (iconName) return iconName;
    
    // Default icons by section number
    const defaultIcons = {
        1: '🥫',  // Food Storage
        2: '❄️',  // Fridges
        3: '🍽️',  // Utensils
        4: '👨‍🍳', // Food Handling
        5: '🧹',  // Cleaning
        6: '🧼',  // Personal Hygiene
        7: '🚻',  // Restrooms
        8: '🗑️',  // Garbage
        9: '🛠️',  // Maintenance
        10: '🧪', // Chemicals
        11: '📋', // Monitoring
        12: '🏛️', // Culture
        13: '📜'  // Policies
    };
    
    return defaultIcons[sectionNumber] || '📋';
}

/**
 * Round percentage to nearest integer
 * @param {number} value - Value to round
 * @returns {number} - Rounded value
 */
function roundPercentage(value) {
    return Math.round(value || 0);
}

/**
 * Generate unique ID
 * @returns {string} - Unique ID
 */
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Format finding text with "Good observation" highlighted in green
 * Looks for "good observation" (case-insensitive) and styles the phrase 
 * and everything after it in green
 * @param {string} text - Finding text
 * @returns {string} - Formatted HTML with green highlighting
 */
function formatFindingWithGoodObservation(text) {
    if (!text) return '';
    
    // Normalize text (handle different line break formats)
    const normalizedText = String(text);
    
    // Case-insensitive search for "good observation"
    const regex = /good\s*observation/i;
    const match = normalizedText.match(regex);
    
    if (!match) {
        return escapeHtml(normalizedText);
    }
    
    const matchIndex = match.index;
    const beforeText = normalizedText.substring(0, matchIndex);
    const goodObsPhrase = match[0];
    const afterText = normalizedText.substring(matchIndex + goodObsPhrase.length);
    
    // Build the formatted HTML with improved styling
    let html = escapeHtml(beforeText);
    
    // Add a visual separator before the good observation block
    html += `<div style="margin-top: 8px; padding: 8px 10px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%); border-left: 3px solid #10b981; border-radius: 4px;">`;
    html += `<span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85em;">${escapeHtml(goodObsPhrase)}</span>`;
    
    // Everything after (including colon, text, etc.) should be green
    if (afterText) {
        html += `<span style="color: #059669; font-weight: 500; margin-left: 4px;">${escapeHtml(afterText)}</span>`;
    }
    html += `</div>`;
    
    return html;
}

module.exports = {
    cleanText,
    escapeHtml,
    formatDate,
    formatTime,
    getPriorityBadge,
    getAnswerClass,
    getSectionIcon,
    roundPercentage,
    generateId,
    truncateText,
    formatFindingWithGoodObservation
};
