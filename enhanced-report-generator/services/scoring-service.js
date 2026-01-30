/**
 * Scoring Service
 * Handles all scoring calculations and performance evaluations
 */

class ScoringService {
    /**
     * Calculate value based on selected choice and coefficient (PowerApps logic)
     * @param {string} selectedChoice - The answer selected (Yes, Partially, No, NA)
     * @param {number} coeff - The coefficient/weight for this question
     * @returns {number|null} - Calculated value or null for NA
     */
    calculateValue(selectedChoice, coeff) {
        let value;
        
        switch (selectedChoice) {
            case 'Yes':
                value = coeff;
                break;
            case 'Partially':
                value = coeff / 2;
                break;
            case 'No':
                value = 0;
                break;
            case 'NA':
                value = null; // Blank in PowerApps
                break;
            default:
                value = 0;
        }
        
        return value;
    }

    /**
     * Calculate performance based on score with dynamic thresholds
     * @param {number} score - The score percentage
     * @param {number} threshold - Dynamic passing threshold (default: 83)
     * @returns {string} - Performance text
     */
    calculatePerformance(score, threshold = 83) {
        if (score === 0) return "Fail ❌";
        if (score >= threshold) return "Pass ✅";
        return "Fail ❌";
    }

    /**
     * Get score status with dynamic thresholds
     * @param {number} score - The score percentage
     * @param {number} threshold - Dynamic passing threshold (default: 83)
     * @returns {string} - Status text
     */
    getScoreStatus(score, threshold = 83) {
        if (score === 0) return "No Data";
        if (score < threshold) return "FAIL";
        return "PASS";
    }

    /**
     * Get score emoji with dynamic thresholds
     * @param {number} score - The score percentage
     * @param {number} threshold - Dynamic passing threshold (default: 83)
     * @returns {string} - Emoji representation
     */
    getScoreEmoji(score, threshold = 83) {
        if (score === 0) return "⚪";
        if (score < threshold) return "🔴";
        return "🟢";
    }

    /**
     * Get formatted score with percentage
     * @param {number} score - The score
     * @returns {string} - Formatted score
     */
    getFormattedScore(score) {
        if (score === null || score === undefined || isNaN(score)) {
            return '-';
        }
        return Math.round(score) + '%';
    }

    /**
     * Get CSS class for severity (ENHANCED from lines 1439-1448)
     * @param {string} priority - Priority level
     * @returns {string} - CSS class name
     */
    getSeverityClass(priority) {
        if (!priority) return 'severity-low';
        
        const priorityLower = priority.toLowerCase();
        if (priorityLower.includes('high') || priorityLower.includes('critical')) return 'severity-high';
        if (priorityLower.includes('medium') || priorityLower.includes('moderate')) return 'severity-medium';
        return 'severity-low';
    }

    /**
     * Get severity from score comparison (NEW from lines 1430-1438)
     * Automatically calculates priority based on score vs coefficient percentage
     * @param {number} value - The actual value/score
     * @param {number} coeff - The coefficient/weight (max possible)
     * @returns {string} - Severity level: 'High', 'Medium', or 'Low'
     */
    getSeverityFromScore(value, coeff) {
        if (!value || !coeff) return 'Medium';
        const percentage = (value / coeff) * 100;
        if (percentage < 50) return 'High';
        if (percentage < 80) return 'Medium';
        return 'Low';
    }

    /**
     * Get CSS class for answer styling (ENHANCED with numeric support)
     * @param {string|number} answer - The answer value
     * @returns {string} - CSS class name
     */
    getAnswerClass(answer) {
        if (!answer) return '';
        
        // Handle numeric answers first
        if (typeof answer === 'number' || !isNaN(answer)) {
            const numAnswer = parseFloat(answer);
            if (numAnswer === 2) return 'answer-yes';
            if (numAnswer === 1) return 'answer-partial';
            if (numAnswer === 0) return 'answer-no';
        }
        
        // Handle string answers
        const answerLower = String(answer).toLowerCase();
        if (answerLower === 'yes' || answerLower === '2') return 'answer-yes';
        if (answerLower === 'no' || answerLower === '0') return 'answer-no';
        if (answerLower === 'partially' || answerLower === '1') return 'answer-partial';
        if (answerLower === 'na' || answerLower === 'n/a') return 'answer-na';
        return '';
    }

    /**
     * Calculate section score from items
     * @param {Array} items - Array of section items with values
     * @returns {number} - Calculated section score
     */
    calculateSectionScore(items) {
        if (!items || items.length === 0) return 0;
        
        let totalValue = 0;
        let totalCoeff = 0;
        
        for (const item of items) {
            const coeff = parseFloat(item.Coeff || item.Coef || 0);
            const value = item.Value;
            
            if (value !== null && value !== undefined && !isNaN(value)) {
                totalValue += parseFloat(value);
                totalCoeff += coeff;
            }
        }
        
        if (totalCoeff === 0) return 0;
        
        return Math.round((totalValue / totalCoeff) * 100);
    }

    /**
     * Process item from JSON response data
     * @param {Object} jsonItem - Raw item from ResponseJSON
     * @returns {Object} - Processed item with calculated values
     */
    processResponseItem(jsonItem) {
        const coeff = parseFloat(jsonItem.Coeff || jsonItem.Coef || 0);
        const selectedChoice = jsonItem.SelectedChoice || '';
        const value = this.calculateValue(selectedChoice, coeff);

        return {
            Id: jsonItem.Id || 'N/A',
            Title: jsonItem.Title || 'N/A',
            Answer: jsonItem.Answer || '',
            Coeff: coeff,
            SelectedChoice: selectedChoice,
            comment: jsonItem.comment || '',
            correctedaction: jsonItem.correctedaction || '',
            Priority: jsonItem.Priority || '',
            Picture: jsonItem.Picture || '',
            SelectedCr: jsonItem.SelectedCr || '',
            cr: jsonItem.cr || '',
            Finding: jsonItem.Finding || '',
            ReferenceValue: jsonItem.ReferenceValue || '',
            Value: value
        };
    }
}

module.exports = ScoringService;
