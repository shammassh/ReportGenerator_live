/**
 * Configuration for Enhanced Report Generator
 */

module.exports = {
    // Output directory for generated reports
    outputDir: './reports',

    // SharePoint site URL from environment
    siteUrl: process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations/',

    // Section mappings - template questions to answer lists
    sectionMappings: {
        'Food Storage': { 
            templateListName: 'Food Storage & Dry Storage',
            answerListName: 'Survey Responses List',
            icon: '🥫', 
            title: 'Food Storage and Dry Storage',
            scoreField: 'FoodScore'
        },
        'Fridges': { 
            templateListName: 'Fridges and Freezers',
            answerListName: 'SRA Fridges',
            icon: '❄️', 
            title: 'Fridges and Freezers',
            scoreField: 'FridgesScore'
        },
        'Utensils': { 
            templateListName: 'Utensils and Equipment',
            answerListName: 'SRA Utensils and Equipment',
            icon: '🍽️', 
            title: 'Utensils and Equipment',
            scoreField: 'UtensilsScore'
        },
        'Food Handling': { 
            templateListName: 'Food Handling',
            answerListName: 'SRA Food Handling',
            icon: '👨‍🍳', 
            title: 'Food Handling',
            scoreField: 'FoodHScore'
        },
        'Cleaning': { 
            templateListName: 'Cleaning and Disinfection',
            answerListName: 'SRA Cleaning and Disinfection',
            icon: '🧹', 
            title: 'Cleaning and Disinfection',
            scoreField: 'CNDScore'
        },
        'Hygiene': { 
            templateListName: 'Personal Hygiene',
            answerListName: 'SRA Personal Hygiene',
            icon: '🧼', 
            title: 'Personal Hygiene',
            scoreField: 'HygScore'
        },
        'Restrooms': { 
            templateListName: 'Restrooms',
            answerListName: 'SRA Restrooms',
            icon: '🚻', 
            title: 'Restrooms',
            scoreField: 'RestroomScore'
        },
        'Garbage': { 
            templateListName: 'Garbage Storage & Disposal',
            answerListName: 'SRA Garbage Storage and Disposal',
            icon: '🗑️', 
            title: 'Garbage Storage and Disposal',
            scoreField: 'GarScore'
        },
        'Maintenance': { 
            templateListName: 'Maintenance',
            answerListName: 'SRA Maintenance',
            icon: '🛠️', 
            title: 'Maintenance',
            scoreField: 'MaintScore'
        },
        'Chemicals': { 
            templateListName: 'Chemicals Available',
            answerListName: 'SRA Chemicals Available',
            icon: '🧪', 
            title: 'Chemicals Available',
            scoreField: 'ChemScore'
        },
        'Monitoring': { 
            templateListName: 'Monitoring Sheets',
            answerListName: 'SRA Monitoring Sheets are Properly Filled/ Documents Present',
            icon: '📋', 
            title: 'Monitoring Sheets',
            scoreField: 'MonitScore'
        },
        'Policies': { 
            templateListName: 'Policies & Procedures',
            answerListName: 'SRA Policies, Procedures & Posters',
            icon: '📜', 
            title: 'Policies & Procedures',
            scoreField: 'PolScore'
        },
        'Culture': { 
            templateListName: 'Food Safety Culture',
            answerListName: 'SRA Culture',
            icon: '🏛️', 
            title: 'Food Safety Culture',
            scoreField: 'CultScore'
        }
    },

    // Report generation options
    reportOptions: {
        // Include inline styles in HTML (for standalone viewing)
        useInlineStyles: true,
        
        // Include inline scripts in HTML
        useInlineScripts: true,
        
        // Convert images to base64 for standalone viewing
        convertImagesToBase64: true,
        
        // Include historical data in reports
        includeHistoricalData: true
    },

    // Authentication method - can be 'auto', 'graph', 'interactive'
    authMethod: process.env.AUTH_METHOD || 'auto'
};
