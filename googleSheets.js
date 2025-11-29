    import { google } from 'googleapis';
    import { GoogleAuth } from 'google-auth-library';
    
    // --- IMPORTANT: YOU MUST FILL THESE IN ---
    // New (Generic)
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const SHEET_NAME = 'Sheet1'; // Or whatever your sheet tab is named
    
    // Configure the authentication client
    const auth = new GoogleAuth({
      keyFile: './credentials.json', // Path to your service account key file
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Helper to find a row index based on the unique groupId
    async function findRowIndexByGroupId(groupId) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!B:B`, // Assuming groupId is always in Column B
      });
      const values = response.data.values;
      if (!values) return -1;
      return values.findIndex(row => row[0] === groupId);
    }
    
    // --- Functions to interact with the sheet ---
    
    export async function appendSheetRow(rowData) {
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [rowData],
        },
      });
    }
    
    export async function updateSheetRow(groupId, newGroupName) {
        
        const rowIndex = await findRowIndexByGroupId(groupId);
        if (rowIndex === -1) {
            console.log(`Could not find row with groupId ${groupId} to update.`);
            return;
        }
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!C${rowIndex + 1}`, // Assuming groupName is in Column C
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newGroupName]],
            },
        });
    }
    
    export async function deleteSheetRow(groupId) {
        
        const rowIndex = await findRowIndexByGroupId(groupId);
        if (rowIndex === -1) {
            console.log(`Could not find row with groupId ${groupId} to delete.`);
            return;
        }
    
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetId = sheetInfo.data.sheets.find(s => s.properties.title === SHEET_NAME)?.properties.sheetId;
    
        if (sheetId === undefined) return;
    
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1
                        }
                    }
                }]
            }
        });
    }
    // Add this new function to googleSheets.js

export async function batchAppendSheetRows(rowsData) {
  if (rowsData.length === 0) {
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: rowsData, // Pass the array of rows directly
    },
  });
}
    
