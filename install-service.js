const Service = require('node-windows').Service;

const svc = new Service({
    name: 'FSAudit UAT',
    description: 'FSAudit UAT Application',
    script: 'F:\\ReportGenerator\\auth-app.js',
    workingDirectory: 'F:\\ReportGenerator',
    env: [{ name: "NODE_ENV", value: "production" }]
});

svc.on('install', () => { console.log('Service installed!'); svc.start(); });
svc.install();
