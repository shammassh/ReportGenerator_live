/**
 * Food Safety Audit Report - Client-Side JavaScript
 * Handles interactive features like charts and image modals
 */

/**
 * Initialize the category performance chart using Chart.js
 * Shows grouped categories with their sub-sections
 * @param {Array} categoryData - Array of category/sub-section objects with scores
 * @param {Object} thresholds - Scoring thresholds from SharePoint config
 */
function initializeCategoryChart(categoryData, thresholds) {
    const ctx = document.getElementById('sectionChart');
    if (!ctx) return;
    
    // Use thresholds from SharePoint config, or defaults
    const categoryThreshold = (thresholds && thresholds.category) || 83;
    const sectionThreshold = (thresholds && thresholds.section) || 89;
    
    const chartContext = ctx.getContext('2d');
    const scores = categoryData.map(item => item.score);
    const labels = categoryData.map(item => item.name);
    const isCategory = categoryData.map(item => item.isCategory);
    
    // Color bars: Green for pass, Red for fail
    // Categories use categoryThreshold, sections use sectionThreshold
    const backgroundColors = categoryData.map((item) => {
        const threshold = item.isCategory ? categoryThreshold : sectionThreshold;
        return item.score >= threshold ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)';
    });
    
    const borderColors = categoryData.map((item) => {
        const threshold = item.isCategory ? categoryThreshold : sectionThreshold;
        return item.score >= threshold ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)';
    });
    
    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Scores (%)',
            data: scores,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: categoryData.map(item => item.isCategory ? 3 : 1)
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(event, activeElements) {
            if (activeElements.length > 0) {
                const clickedIndex = activeElements[0].index;
                const item = categoryData[clickedIndex];
                
                // Only navigate for sub-sections (not categories)
                if (!item.isCategory && item.sectionId) {
                    // Find the section element by ID and scroll to it
                    const sectionElement = document.getElementById(item.sectionId);
                    if (sectionElement) {
                        sectionElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                        });
                        // Add a highlight effect
                        sectionElement.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                        setTimeout(() => {
                            sectionElement.style.boxShadow = '';
                        }, 2000);
                    }
                } else if (!item.isCategory) {
                    // Fallback: search by title
                    const sectionName = item.name;
                    const sectionElements = document.querySelectorAll('.section');
                    for (let i = 0; i < sectionElements.length; i++) {
                        const titleElement = sectionElements[i].querySelector('.section-title');
                        if (titleElement && titleElement.textContent.trim().includes(sectionName)) {
                            sectionElements[i].scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                            });
                            sectionElements[i].style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                            setTimeout(() => {
                                sectionElements[i].style.boxShadow = '';
                            }, 2000);
                            break;
                        }
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: 'Score (%)',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0,0,0,0.08)',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 10
                    },
                    callback: function(value) {
                        return value + '%';
                    }
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Categories & Sections',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    font: {
                        size: 9,
                        weight: function(context) {
                            return categoryData[context.index] && categoryData[context.index].isCategory ? 'bold' : 'normal';
                        }
                    },
                    color: function(context) {
                        return categoryData[context.index] && categoryData[context.index].isCategory ? '#000' : '#555';
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 11
                },
                callbacks: {
                    label: function(context) {
                        const item = categoryData[context.dataIndex];
                        const type = item.isCategory ? 'Category' : 'Section';
                        return type + ' Score: ' + context.parsed.y + '%';
                    }
                }
            },
            datalabels: {
                anchor: 'end',
                align: 'top',
                formatter: function(value) {
                    return value + '%';
                },
                font: {
                    size: 10,
                    weight: function(context) {
                        return categoryData[context.dataIndex] && categoryData[context.dataIndex].isCategory ? 'bold' : 'normal';
                    }
                },
                color: function(context) {
                    const item = categoryData[context.dataIndex];
                    const threshold = item.isCategory ? categoryThreshold : sectionThreshold;
                    return item.score >= threshold ? '#28a745' : '#dc3545';
                }
            }
        },
        animation: {
            duration: 800,
            easing: 'easeInOutQuad'
        },
        layout: {
            padding: {
                top: 20
            }
        }
    };

    // Create the chart
    new Chart(chartContext, {
        type: 'bar',
        data: chartData,
        options: chartOptions,
        plugins: [ChartDataLabels]
    });
}

/**
 * Initialize the section performance chart using Chart.js (legacy)
 * @param {Array} sections - Array of section objects with scores
 */
function initializeSectionChart(sections) {
    const ctx = document.getElementById('sectionChart');
    if (!ctx) return;
    
    const chartContext = ctx.getContext('2d');
    const scores = sections.map(section => section.score);
    const labels = sections.map(section => section.title);
    
    // Color bars based on score (green for pass >= 89, red for fail)
    const backgroundColors = scores.map(score => 
        score >= 89 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)'
    );
    const borderColors = scores.map(score => 
        score >= 89 ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)'
    );
    
    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Section Scores (%)',
            data: scores,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(event, activeElements) {
            if (activeElements.length > 0) {
                const clickedIndex = activeElements[0].index;
                const sectionTitle = labels[clickedIndex];
                
                // Find the section element by title and scroll to it
                const sectionElements = document.querySelectorAll('.section');
                for (let i = 0; i < sectionElements.length; i++) {
                    const titleElement = sectionElements[i].querySelector('.section-title');
                    if (titleElement && titleElement.textContent.trim().includes(sectionTitle)) {
                        sectionElements[i].scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                        });
                        // Add a highlight effect
                        sectionElements[i].style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                        setTimeout(() => {
                            sectionElements[i].style.boxShadow = '';
                        }, 2000);
                        break;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: 'Score (%)',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0,0,0,0.08)',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 10
                    },
                    callback: function(value) {
                        return value + '%';
                    }
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Audit Sections',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    font: {
                        size: 9
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 11
                },
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + context.parsed.y + '%';
                    }
                }
            },
            datalabels: {
                anchor: 'end',
                align: 'top',
                formatter: function(value) {
                    return value + '%';
                },
                font: {
                    size: 11,
                    weight: 'bold'
                },
                color: function(context) {
                    return context.dataset.data[context.dataIndex] >= 89 ? '#28a745' : '#dc3545';
                }
            }
        },
        animation: {
            duration: 800,
            easing: 'easeInOutQuad'
        },
        layout: {
            padding: {
                top: 30,
                bottom: 10,
                left: 10,
                right: 10
            }
        }
    };

    new Chart(chartContext, {
        type: 'bar',
        data: chartData,
        options: chartOptions,
        plugins: [ChartDataLabels]
    });
}

/**
 * Open image modal with full-size image
 * @param {string} imageUrl - URL or base64 data of the image
 * @param {string} title - Title of the audit item
 * @param {string} imageID - Image ID from SharePoint
 * @param {string} created - Creation date of the image
 */
function openImageModal(imageUrl, title, imageID, created) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const caption = document.getElementById('modalCaption');
    
    if (!modal || !modalImg || !caption) return;
    
    modal.classList.add('show');
    modalImg.src = imageUrl;
    caption.innerHTML = '<strong>' + title + '</strong><br>' + 
                       'Image ID: ' + imageID + '<br>' + 
                       'Created: ' + created;
    
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
}

/**
 * Close the image modal
 * @param {Event} event - Click event
 */
function closeImageModal(event) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    if (!modal || !modalImg) return;
    
    // Only close if clicking on the modal background or close button
    if (event.target === modal || event.target.className.includes('modal-close')) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Clear the image after animation
        setTimeout(() => {
            modalImg.src = '';
        }, 300);
    }
}

/**
 * Save report to database
 * Extracts report data from the page and sends to server
 */
async function saveReportToDatabase() {
    const saveBtn = document.getElementById('saveReportBtn');
    const saveStatus = document.getElementById('saveStatus');
    
    if (!saveBtn || !saveStatus) return;
    
    // Disable button
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Saving...</span>';
    
    try {
        // Extract document number from page
        const docNumElement = document.querySelector('.info-item .info-value');
        const documentNumber = docNumElement ? docNumElement.textContent.trim() : '';
        
        if (!documentNumber) {
            throw new Error('Document number not found');
        }
        
        // Extract report data from the page
        const reportData = {
            documentNumber: documentNumber,
            reportType: 'Enhanced HTML',
            filePath: window.location.pathname,
            
            // Extract store name
            storeName: extractInfoValue('Store Name'),
            
            // Extract audit date
            auditDate: extractInfoValue('Audit Date'),
            
            // Extract overall score
            overallScore: extractOverallScore(),
            
            // Extract all section scores
            sections: extractSectionScores(),
            
            // Metadata
            generatedAt: new Date().toISOString(),
            reportUrl: window.location.href
        };
        
        // Send to server
        const response = await fetch('/api/reports/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Show success message with action type
        if (result.action === 'updated') {
            saveStatus.textContent = '✓ Report updated successfully!';
            saveStatus.className = 'save-status success';
        } else {
            saveStatus.textContent = '✓ Report saved successfully!';
            saveStatus.className = 'save-status success';
        }
        
        // Update button to show it can be clicked again
        saveBtn.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">Save to Database</span>';
        saveBtn.disabled = false;
        
        // Clear status after 5 seconds (increased from 3 to give user time to read)
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = 'save-status';
        }, 5000);
        
    } catch (error) {
        console.error('Error saving report:', error);
        
        // Show error message
        saveStatus.textContent = `✗ Error: ${error.message}`;
        saveStatus.className = 'save-status error';
        
        // Reset button
        saveBtn.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">Save to Database</span>';
        saveBtn.disabled = false;
        
        // Clear status after 5 seconds
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = 'save-status';
        }, 5000);
    }
}

/**
 * Helper function to extract info value by label
 */
function extractInfoValue(label) {
    const infoItems = document.querySelectorAll('.info-item');
    for (let item of infoItems) {
        const labelEl = item.querySelector('.info-label');
        if (labelEl && labelEl.textContent.includes(label)) {
            const valueEl = item.querySelector('.info-value');
            return valueEl ? valueEl.textContent.trim() : '';
        }
    }
    return '';
}

/**
 * Extract overall score from performance banner
 */
function extractOverallScore() {
    const banner = document.querySelector('.performance-banner');
    if (!banner) return 0;
    
    const text = banner.textContent;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * Extract section scores from the page
 */
function extractSectionScores() {
    const sections = [];
    const sectionElements = document.querySelectorAll('.section');
    
    sectionElements.forEach(section => {
        const titleEl = section.querySelector('.section-title');
        const scoreEl = section.querySelector('.section-score');
        
        if (titleEl && scoreEl) {
            const title = titleEl.textContent.trim();
            const scoreText = scoreEl.textContent.trim();
            const scoreMatch = scoreText.match(/(\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            
            sections.push({
                title: title,
                score: score
            });
        }
    });
    
    return sections;
}

/**
 * Initialize event listeners when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('imageModal');
            if (modal && modal.classList.contains('show')) {
                modal.classList.remove('show');
                document.body.style.overflow = 'auto';
                setTimeout(() => {
                    const modalImg = document.getElementById('modalImage');
                    if (modalImg) modalImg.src = '';
                }, 300);
            }
        }
    });
});
