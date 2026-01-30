# SharePoint App Registration Setup Guide

This guide will help you create and configure an Azure AD App Registration for secure, non-interactive SharePoint access.

## Prerequisites

- Access to Azure Portal (admin or app registration permissions)
- SharePoint Online tenant
- PowerShell 7 installed
- PnP PowerShell module

## Step 1: Create Azure AD App Registration

### 1.1 Access Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**

### 1.2 Configure App Registration
- **Name**: SharePoint Report Generator
- **Account types**: Accounts in this organizational directory only
- **Redirect URI**: Leave blank for now
- Click **Register**

### 1.3 Note Important Information
After creation, note down:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## Step 2: Configure Authentication

Choose **ONE** of the following authentication methods:

### Option A: Client Secret (Simpler)

#### 2A.1 Create Client Secret
1. Go to **Certificates & secrets** tab
2. Click **New client secret**
3. Description: "SharePoint Connector Secret"
4. Expires: Choose appropriate duration (12 months recommended)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again)

#### 2A.2 Environment Variables
Add to your `.env` file:
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/yoursite
```

### Option B: Certificate (More Secure)

#### 2B.1 Generate Self-Signed Certificate
Run in PowerShell (as Administrator):
```powershell
# Generate certificate
$cert = New-SelfSignedCertificate -Subject "CN=SharePointReportGenerator" -CertStoreLocation "Cert:\CurrentUser\My" -KeyExportPolicy Exportable -KeySpec Signature -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256

# Export certificate
$certPassword = ConvertTo-SecureString -String "YourCertPassword123!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "C:\temp\SharePointCert.pfx" -Password $certPassword
Export-Certificate -Cert $cert -FilePath "C:\temp\SharePointCert.cer"

# Get thumbprint
$cert.Thumbprint
```

#### 2B.2 Upload Certificate
1. In Azure Portal, go to **Certificates & secrets** tab
2. Click **Upload certificate**
3. Upload the `.cer` file you created
4. Add description: "SharePoint Connector Certificate"

#### 2B.3 Environment Variables
Add to your `.env` file:
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CERTIFICATE_PATH=C:\temp\SharePointCert.pfx
AZURE_CERTIFICATE_PASSWORD=YourCertPassword123!
AZURE_CERTIFICATE_THUMBPRINT=certificate-thumbprint-from-powershell
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/yoursite
```

## Step 3: Configure API Permissions

### 3.1 Add SharePoint Permissions
1. Go to **API permissions** tab
2. Click **Add a permission**
3. Select **SharePoint**
4. Choose **Application permissions**
5. Add these permissions:
   - `Sites.FullControl.All` (for full access)
   - OR `Sites.Read.All` (for read-only access)
   - OR `Sites.ReadWrite.All` (for read/write access)

### 3.2 Grant Admin Consent
1. Click **Grant admin consent for [your tenant]**
2. Confirm the consent

## Step 4: Configure SharePoint App Catalog (if needed)

If using app-only permissions, you may need to register the app in SharePoint:

```powershell
# Connect to SharePoint as admin
Connect-PnPOnline -Url https://yourtenant-admin.sharepoint.com -Interactive

# Register the app
Register-PnPApp -ClientId "your-client-id" -Scope Site
```

## Step 5: Test the Connection

Create a test script:

```javascript
const AppRegistrationConnector = require('./src/app-registration-connector');

async function testConnection() {
    const connector = new AppRegistrationConnector({
        siteUrl: process.env.SHAREPOINT_SITE_URL,
        tenantId: process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET // or certificate config
    });

    const result = await connector.testConnection();
    console.log('Test Result:', result);
    
    if (result.success) {
        const lists = await connector.getLists();
        console.log('Available lists:', lists.map(l => l.Title));
    }
    
    await connector.disconnect();
}

testConnection().catch(console.error);
```

## Security Best Practices

1. **Use Certificates over Client Secrets** when possible
2. **Limit Permissions** to only what's needed
3. **Rotate Secrets/Certificates** regularly
4. **Store Credentials Securely** (Azure Key Vault in production)
5. **Use Least Privilege** principle
6. **Monitor Access** through Azure AD audit logs

## Troubleshooting

### Common Issues

#### 1. "AADSTS65001: The user or administrator has not consented"
**Solution**: Grant admin consent in Azure Portal

#### 2. "AADSTS70011: The provided value for the input parameter 'scope' is not valid"
**Solution**: Check your API permissions and ensure they're application permissions, not delegated

#### 3. "Access denied" when accessing SharePoint
**Solution**: 
- Ensure app has proper SharePoint permissions
- Register app in SharePoint App Catalog if needed
- Check site collection app permissions

#### 4. Certificate errors
**Solution**:
- Ensure certificate is properly uploaded to Azure AD
- Check certificate path and password
- Verify thumbprint matches

### Testing Commands

```powershell
# Test PowerShell connection manually
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/yoursite" -ClientId "your-client-id" -ClientSecret "your-client-secret" -Tenant "your-tenant-id"

# Test with certificate
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/yoursite" -ClientId "your-client-id" -Thumbprint "certificate-thumbprint" -Tenant "your-tenant-id"

# Get lists to verify connection
Get-PnPList
```

## Environment File Template

Create a `.env` file in your project root:

```env
# SharePoint Configuration
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/yoursite

# Azure AD App Registration
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Choose ONE authentication method:

# Option 1: Client Secret
AZURE_CLIENT_SECRET=your-secret-value

# Option 2: Certificate
# AZURE_CERTIFICATE_PATH=C:\path\to\certificate.pfx
# AZURE_CERTIFICATE_PASSWORD=certificate-password
# AZURE_CERTIFICATE_THUMBPRINT=certificate-thumbprint
```

This setup provides enterprise-grade authentication for your SharePoint connector without requiring interactive login.