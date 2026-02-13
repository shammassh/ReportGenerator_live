require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Choose connector based on AUTH_METHOD
function getConnector(config = {}) {
    const authMethod = process.env.AUTH_METHOD || 'auto';
    
    switch (authMethod) {
        case 'graph':
            const SimpleGraphConnector = require('./src/simple-graph-connector.js');
            return new SimpleGraphConnector(config);
        case 'interactive':
            const InteractiveConnector = require('./src/simple-graph-connector.js');
            return new InteractiveConnector(config);
        case 'auto':
        default:
            // Auto-detect: use graph if Azure credentials available
            if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                const SimpleGraphConnector = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnector(config);
            } else {
                const SimpleGraphConnector = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnector(config);
            }
    }
}

class SurveyReportGenerator {
    constructor() {
        this.connector = getConnector();
        this.outputDir = './reports';
    }

    async generateSurveyReport(listName) {
        try {
            console.log(`🚀 Generating comprehensive report for: ${listName}`);
            
            // Ensure reports directory exists
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Connect and get data
            await this.connector.connectToSharePoint();
            const surveyItems = await this.connector.getListItems(listName);
            
            console.log(`📊 Processing ${surveyItems.length} survey responses...`);
            
            // Parse and analyze the survey data
            const analysis = this.analyzeSurveyData(surveyItems);
            
            // Generate different report formats
            await this.generateSummaryReport(analysis, listName);
            await this.generateDetailedReport(analysis, listName);
            await this.generateComplianceReport(analysis, listName);
            
            console.log('✅ All reports generated successfully!');
            
            // Disconnect
            await this.connector.disconnect();
            
        } catch (error) {
            console.error('❌ Error generating survey report:', error.message);
        }
    }

    analyzeSurveyData(surveyItems) {
        const analysis = {
            totalResponses: surveyItems.length,
            questions: new Map(),
            cycles: new Map(),
            complianceStats: {
                compliant: 0,
                partiallyCompliant: 0,
                nonCompliant: 0,
                notApplicable: 0
            },
            findings: [],
            trends: []
        };

        surveyItems.forEach(item => {
            try {
                const responseData = JSON.parse(item.ResponseJSON);
                const cycle = item.Cycle || 'Unknown';
                const date = new Date(item.Created);

                if (!analysis.cycles.has(cycle)) {
                    analysis.cycles.set(cycle, {
                        count: 0,
                        responses: [],
                        complianceScore: 0
                    });
                }
                analysis.cycles.get(cycle).count++;

                responseData.forEach(question => {
                    const questionTitle = question.Title;
                    
                    if (!analysis.questions.has(questionTitle)) {
                        analysis.questions.set(questionTitle, {
                            title: questionTitle,
                            responses: [],
                            yesCount: 0,
                            partiallyCount: 0,
                            noCount: 0,
                            naCount: 0,
                            totalWeight: 0,
                            findings: []
                        });
                    }

                    const q = analysis.questions.get(questionTitle);
                    q.responses.push({
                        choice: question.SelectedChoice,
                        value: question.Value,
                        date: date,
                        cycle: cycle,
                        finding: question.Finding,
                        priority: question.Priority
                    });

                    // Count responses
                    switch (question.SelectedChoice?.toLowerCase()) {
                        case 'yes':
                            q.yesCount++;
                            analysis.complianceStats.compliant++;
                            break;
                        case 'partially':
                            q.partiallyCount++;
                            analysis.complianceStats.partiallyCompliant++;
                            break;
                        case 'no':
                            q.noCount++;
                            analysis.complianceStats.nonCompliant++;
                            break;
                        case 'na':
                            q.naCount++;
                            analysis.complianceStats.notApplicable++;
                            break;
                    }

                    // Collect findings
                    if (question.Finding) {
                        analysis.findings.push({
                            question: questionTitle,
                            finding: question.Finding,
                            priority: question.Priority,
                            date: date,
                            cycle: cycle
                        });
                        q.findings.push(question.Finding);
                    }

                    q.totalWeight += question.Coeff || 0;
                });

            } catch (parseError) {
                console.warn(`⚠️ Could not parse ResponseJSON for item ${item.ID}:`, parseError.message);
            }
        });

        return analysis;
    }

    async generateSummaryReport(analysis, listName) {
        const reportDate = new Date().toISOString().split('T')[0];
        
        const summaryReport = {
            reportInfo: {
                title: `${listName} - Summary Report`,
                generatedDate: reportDate,
                totalResponses: analysis.totalResponses,
                totalQuestions: analysis.questions.size
            },
            overallCompliance: {
                compliant: analysis.complianceStats.compliant,
                partiallyCompliant: analysis.complianceStats.partiallyCompliant,
                nonCompliant: analysis.complianceStats.nonCompliant,
                notApplicable: analysis.complianceStats.notApplicable,
                complianceRate: (analysis.complianceStats.compliant / 
                    (analysis.complianceStats.compliant + analysis.complianceStats.partiallyCompliant + analysis.complianceStats.nonCompliant)) * 100
            },
            cycleBreakdown: Array.from(analysis.cycles.entries()).map(([cycle, data]) => ({
                cycle: cycle,
                responseCount: data.count
            })),
            topFindings: analysis.findings
                .filter(f => f.priority && f.priority !== '')
                .slice(0, 10)
                .map(f => ({
                    question: f.question,
                    finding: f.finding,
                    priority: f.priority,
                    date: f.date
                })),
            questionSummary: Array.from(analysis.questions.entries())
                .map(([title, data]) => ({
                    question: title,
                    yesCount: data.yesCount,
                    partiallyCount: data.partiallyCount,
                    noCount: data.noCount,
                    naCount: data.naCount,
                    complianceRate: data.yesCount / (data.yesCount + data.partiallyCount + data.noCount) * 100 || 0,
                    findingsCount: data.findings.length
                }))
                .sort((a, b) => a.complianceRate - b.complianceRate) // Lowest compliance first
        };

        const fileName = `${listName.replace(/[^a-zA-Z0-9]/g, '_')}_summary_${reportDate}.json`;
        await fs.writeFile(path.join(this.outputDir, fileName), JSON.stringify(summaryReport, null, 2));
        
        console.log(`✅ Summary report saved: ${fileName}`);
        console.log(`📊 Overall compliance rate: ${summaryReport.overallCompliance.complianceRate.toFixed(1)}%`);
    }

    async generateDetailedReport(analysis, listName) {
        const reportDate = new Date().toISOString().split('T')[0];
        
        const detailedReport = {
            reportInfo: {
                title: `${listName} - Detailed Analysis Report`,
                generatedDate: reportDate
            },
            questionAnalysis: Array.from(analysis.questions.entries()).map(([title, data]) => ({
                question: title,
                statistics: {
                    totalResponses: data.responses.length,
                    yesCount: data.yesCount,
                    partiallyCount: data.partiallyCount,
                    noCount: data.noCount,
                    naCount: data.naCount,
                    complianceRate: (data.yesCount / (data.yesCount + data.partiallyCount + data.noCount)) * 100 || 0
                },
                findings: data.findings,
                responses: data.responses.map(r => ({
                    choice: r.choice,
                    value: r.value,
                    date: r.date,
                    cycle: r.cycle,
                    finding: r.finding,
                    priority: r.priority
                }))
            })),
            allFindings: analysis.findings.map(f => ({
                question: f.question,
                finding: f.finding,
                priority: f.priority,
                date: f.date,
                cycle: f.cycle
            }))
        };

        const fileName = `${listName.replace(/[^a-zA-Z0-9]/g, '_')}_detailed_${reportDate}.json`;
        await fs.writeFile(path.join(this.outputDir, fileName), JSON.stringify(detailedReport, null, 2));
        
        console.log(`✅ Detailed report saved: ${fileName}`);
    }

    async generateComplianceReport(analysis, listName) {
        const reportDate = new Date().toISOString().split('T')[0];
        
        // Generate CSV format for easy analysis
        const csvLines = [
            'Question,Yes_Count,Partially_Count,No_Count,NA_Count,Compliance_Rate,Findings_Count,Priority_Issues'
        ];

        Array.from(analysis.questions.entries()).forEach(([title, data]) => {
            const complianceRate = (data.yesCount / (data.yesCount + data.partiallyCount + data.noCount)) * 100 || 0;
            const priorityFindings = data.responses.filter(r => r.priority && r.priority !== '').length;
            
            csvLines.push([
                `"${title.replace(/"/g, '""')}"`,
                data.yesCount,
                data.partiallyCount,
                data.noCount,
                data.naCount,
                complianceRate.toFixed(2),
                data.findings.length,
                priorityFindings
            ].join(','));
        });

        const csvFileName = `${listName.replace(/[^a-zA-Z0-9]/g, '_')}_compliance_${reportDate}.csv`;
        await fs.writeFile(path.join(this.outputDir, csvFileName), csvLines.join('\\n'));
        
        console.log(`✅ Compliance CSV saved: ${csvFileName}`);
    }
}

// Run the report generator
async function main() {
    const generator = new SurveyReportGenerator();
    await generator.generateSurveyReport('Survey Responses List');
}

main();